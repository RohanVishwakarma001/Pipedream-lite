# Pipedream-lite — Server

The backend API and execution runtime for **Pipedream-lite**. It stores pipelines and their versions, exposes the REST API, receives webhook triggers, runs pipelines node-by-node, and streams live execution logs to the client over WebSocket.

> Part of the [Pipedream-lite](../README.md) project. See the root README for the full overview.

---

## Tech Stack

- **Express** — HTTP API and webhook endpoints
- **Prisma ORM** + **PostgreSQL** — persistence
- **BullMQ** + **Redis** — background job queue for pipeline runs
- **Socket.io** — live execution log streaming
- **Zod** — request validation
- **TypeScript**, **ts-node-dev** — dev runtime

---

## Project Structure

```
server/
├── prisma/
│   └── schema.prisma          # Pipeline, PipelineVersion, PipelineRun, NodeExecution
└── src/
    ├── index.ts               # app entry — Express + Socket.io + worker bootstrap
    ├── routes/
    │   ├── pipelines.ts        # /api/pipelines CRUD, deploy, rollback, test, export, runs, stats
    │   └── webhooks.ts         # /webhook/:webhookKey trigger
    ├── services/
    │   ├── executionEngine.ts  # walks the node graph and executes each node
    │   ├── sandboxExecutor.ts  # runs user transform JavaScript in isolation
    │   ├── cycleDetection.ts   # rejects pipelines with cycles
    │   └── exportService.ts    # renders a pipeline as a standalone Node.js script
    ├── workers/
    │   └── pipelineWorker.ts    # BullMQ consumer that processes queued runs
    ├── lib/
    │   ├── prisma.ts           # Prisma client singleton
    │   ├── redis.ts            # ioredis connection
    │   └── socket.ts           # Socket.io setup
    └── types/index.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL & Redis (use `docker-compose up -d` from the project root)

### Setup

```bash
cp .env.example .env       # adjust if needed
npm install
npm run db:push            # apply the Prisma schema to the database
npm run dev                # → http://localhost:4000
```

On start the server boots the Express API, the Socket.io server (same port), and the BullMQ worker.

---

## Environment Variables (`.env`)

```env
DATABASE_URL="postgresql://pipedream:pipedream@localhost:5432/pipedream"
REDIS_URL="redis://localhost:6379"
PORT=4000
CLIENT_URL="http://localhost:3000"   # used for CORS + Socket.io origin
NODE_ENV="development"
```

> `CLIENT_URL` has any trailing slash stripped automatically so it matches a browser's `Origin` header for CORS.

---

## Scripts

```bash
npm run dev          # start with hot reload (ts-node-dev)
npm run build        # compile TypeScript to dist/
npm run start        # run the compiled build
npm run db:push      # push Prisma schema to the database
npm run db:generate  # regenerate the Prisma client
npm run db:studio    # open Prisma Studio
npm run db:migrate   # create/apply a migration
```

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health` | Health check |
| `GET`  | `/api/pipelines` | List all pipelines |
| `POST` | `/api/pipelines` | Create a pipeline |
| `GET`  | `/api/pipelines/:id` | Get a pipeline |
| `PUT`  | `/api/pipelines/:id` | Update (auto-creates a new version) |
| `DELETE` | `/api/pipelines/:id` | Delete a pipeline |
| `POST` | `/api/pipelines/:id/deploy` | Deploy the active version |
| `POST` | `/api/pipelines/:id/rollback/:versionId` | Roll back to a version |
| `GET`  | `/api/pipelines/:id/versions` | List versions |
| `POST` | `/api/pipelines/:id/test` | Test run with a custom JSON payload |
| `POST` | `/api/pipelines/:id/export` | Download as a standalone Node.js script |
| `GET`  | `/api/pipelines/:id/runs` | Paginated run history |
| `GET`  | `/api/pipelines/:id/runs/:runId` | Get a single run |
| `GET`  | `/api/pipelines/:id/stats` | Success rate & average duration |
| `ALL`  | `/webhook/:webhookKey` | Trigger a deployed pipeline |

---

## How Execution Works

1. A request hits `/webhook/:webhookKey` (or `/api/pipelines/:id/test`), creating a `PipelineRun`.
2. The run is enqueued in BullMQ.
3. `pipelineWorker` picks it up and hands it to the `executionEngine`.
4. The engine walks the node graph from the `webhook_trigger`, executing each node and recording a `NodeExecution` (input, output, status, duration). `filter` nodes branch on true/false; transform JS runs in `sandboxExecutor`.
5. Progress is streamed to the client over Socket.io in real time.

## Data Model

- **Pipeline** → owns many **PipelineVersion**s (immutable snapshots of `nodes` + `edges`)
- **PipelineRun** → one per trigger, owns many **NodeExecution**s
- Enums: `RunStatus` (RUNNING/SUCCESS/FAILED), `ExecStatus` (PENDING/RUNNING/SUCCESS/FAILED/SKIPPED)

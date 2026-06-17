# Pipedream-lite

A self-hosted, visual **webhook & automation pipeline builder**. Drag nodes onto a canvas, wire them together, deploy, and trigger your workflow with an HTTP request — with versioning, rollbacks, live execution logs, run history, and exportable standalone scripts.

> Project 02 of 05 from the *DevTools Blueprint* portfolio series.

---

## Features

- 🎨 **Visual canvas editor** — build pipelines by dragging and connecting nodes (powered by React Flow)
- 🔌 **8 node types** — webhook trigger, HTTP request, JS/template transform, branching filter, delay, Slack notify, log, and email
- 🚀 **Deploy & trigger** — every deployed pipeline gets a unique webhook URL (`/webhook/:webhookKey`)
- 🕒 **Versioning & rollback** — each save creates a new version; deploy or roll back to any version
- 📡 **Live execution logs** — watch runs stream node-by-node over WebSocket (Socket.io)
- 🧪 **Test runs** — execute a pipeline against a custom JSON payload without deploying
- 📊 **Run history & stats** — paginated run history with success rate and average duration
- 📦 **Export** — download any pipeline as a standalone Node.js script
- 🔒 **Sandboxed transforms** — user JavaScript runs in an isolated sandbox
- 🔁 **Background processing** — runs are queued and processed via BullMQ + Redis

---

## Tech Stack

| Layer    | Technologies |
|----------|--------------|
| **Client**   | Next.js 14 (App Router), React 18, React Flow v11, Monaco Editor, Framer Motion, SWR, Socket.io-client, Tailwind CSS, Lucide |
| **Server**   | Express, Prisma ORM, PostgreSQL, Redis, BullMQ, Socket.io, Zod, TypeScript |
| **Infra**    | Docker Compose (PostgreSQL 15 + Redis 7) |

---

## Architecture

```
Pipedream-lite/
├── docker-compose.yml          # PostgreSQL 15 + Redis 7
├── client/                     # Next.js 14 app (port 3000)
│   └── src/
│       ├── app/pipelines/      # list, new, [id] editor, [id]/logs
│       ├── components/pipeline/# PipelineCanvas, NodePalette, NodeConfigPanel, ExecutionLogViewer, nodes/
│       ├── hooks/              # useWebSocket
│       └── lib/                # api client, utils
└── server/                     # Express API + worker (port 4000)
    ├── prisma/schema.prisma    # Pipeline, PipelineVersion, PipelineRun, NodeExecution
    └── src/
        ├── routes/             # pipelines, webhooks
        ├── services/           # executionEngine, sandboxExecutor, cycleDetection, exportService
        ├── workers/            # pipelineWorker (BullMQ)
        └── lib/                # prisma, redis, socket
```

**Data model:** A `Pipeline` owns many `PipelineVersion`s (immutable snapshots of nodes + edges). Triggering a deployed pipeline creates a `PipelineRun`, which records one `NodeExecution` per node — including input, output, status, and duration.

---

## Node Types

| Type | Description |
|------|-------------|
| `webhook_trigger` | Entry point — receives the incoming HTTP payload |
| `http_request`    | Make an outbound HTTP call |
| `transform`       | Reshape data via JavaScript or a template |
| `filter`          | Branch the flow on a true/false condition |
| `delay`           | Pause execution for a set duration |
| `slack_notify`    | Send a Slack notification |
| `log`             | Write a log entry to the run timeline |
| `email`           | Send an email |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Docker](https://www.docker.com/) & Docker Compose

### 1. Start PostgreSQL + Redis

```bash
docker-compose up -d
```

### 2. Run the server

```bash
cd server
cp .env.example .env        # adjust if needed
npm install
npm run db:push             # apply Prisma schema
npm run dev                 # → http://localhost:4000
```

### 3. Run the client

```bash
cd client
cp .env.local.example .env.local
npm install
npm run dev                 # → http://localhost:3000
```

Open **http://localhost:3000** and start building.

---

## Configuration

### Server (`server/.env`)

```env
DATABASE_URL="postgresql://pipedream:pipedream@localhost:5432/pipedream"
REDIS_URL="redis://localhost:6379"
PORT=4000
CLIENT_URL="http://localhost:3000"
NODE_ENV="development"
```

### Client (`client/.env.local`)

Set the API base URL (see `client/.env.local.example`) to point at the server, e.g. `http://localhost:4000`.

---

## API Reference

Base URL: `http://localhost:4000`

### Pipelines

| Method | Endpoint | Description |
|--------|----------|-------------|
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

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `ALL`  | `/webhook/:webhookKey` | Trigger a deployed pipeline |

---

## Server Scripts

```bash
npm run dev          # start with hot reload (ts-node-dev)
npm run build        # compile TypeScript to dist/
npm run start        # run the compiled build
npm run db:push      # push Prisma schema to the database
npm run db:studio    # open Prisma Studio
npm run db:migrate   # create/apply a migration
```

---

## License

Personal portfolio project.

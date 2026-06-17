# Pipedream-lite — Client

The web frontend for **Pipedream-lite** — a visual pipeline builder where you drag nodes onto a canvas, configure them, deploy, and watch runs execute live.

> Part of the [Pipedream-lite](../README.md) project. See the root README for the full overview.

---

## Tech Stack

- **Next.js 14** (App Router) + **React 18**
- **React Flow v11** — the drag-and-drop pipeline canvas
- **Monaco Editor** — code editing for transform nodes
- **Framer Motion** — animations
- **SWR** — data fetching & caching
- **Socket.io-client** — live execution log streaming
- **Tailwind CSS** + **Lucide** — styling and icons

---

## Project Structure

```
client/
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx                       # landing
    │   └── pipelines/
    │       ├── page.tsx                   # pipeline list
    │       ├── new/page.tsx               # create pipeline
    │       └── [id]/
    │           ├── page.tsx               # canvas editor
    │           └── logs/page.tsx          # execution logs
    ├── components/pipeline/
    │   ├── PipelineCanvas.tsx             # React Flow canvas
    │   ├── NodePalette.tsx                # draggable node list
    │   ├── NodeConfigPanel.tsx            # per-node config (Monaco)
    │   ├── ExecutionLogViewer.tsx         # live run logs
    │   └── nodes/                         # BaseNode + node renderers
    ├── hooks/
    │   └── useWebSocket.ts                # Socket.io connection
    ├── lib/
    │   ├── api.ts                         # server API client
    │   └── utils.ts
    └── types/index.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- The [server](../server/README.md) running on `http://localhost:4000`

### Setup

```bash
cp .env.local.example .env.local
npm install
npm run dev                 # → http://localhost:3000
```

---

## Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:4000   # REST API base URL
NEXT_PUBLIC_WS_URL=http://localhost:4000       # Socket.io URL (same port)
```

---

## Scripts

```bash
npm run dev      # start the dev server (http://localhost:3000)
npm run build    # production build
npm run start    # serve the production build
npm run lint     # run ESLint
```

---

## Key Screens

- **Pipeline list** (`/pipelines`) — browse, create, and open pipelines
- **Canvas editor** (`/pipelines/[id]`) — drag nodes from the palette, wire them up, configure each node, deploy, and test
- **Logs** (`/pipelines/[id]/logs`) — live, node-by-node execution logs streamed over WebSocket

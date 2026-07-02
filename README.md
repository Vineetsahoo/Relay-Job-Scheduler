# Relay — Distributed Job Scheduler

A production-inspired distributed job scheduling platform: a REST API, a
worker service that claims and executes jobs concurrently and safely across
multiple processes, and a React dashboard to watch it all happen.

Built with **Node.js + TypeScript + Express** on the backend, **MongoDB**
for storage, and **React + Vite** on the frontend.

```
job-scheduler/
├── db/
│   ├── init-mongo.js      # run once to create indexes
│   └── schema.sql         # legacy reference only — PostgreSQL original schema
├── server/                # REST API + worker service (same codebase, two entrypoints)
├── client/                # React dashboard
└── docs/                  # architecture, ER diagram, API reference, design decisions
```

---

## Prerequisites

- **Node.js** v18+
- **MongoDB** v6+ running locally, or a [MongoDB Atlas](https://www.mongodb.com/atlas) free cluster

---

## 1. Set up the database

### Local MongoDB
If you have MongoDB installed locally it's already running on `mongodb://localhost:27017` — no extra steps.

### MongoDB Atlas
1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Copy your connection string from **Connect → Drivers** (it looks like `mongodb+srv://...`).

### Create indexes (recommended)
Run the init script once from the project root to create all performance indexes:

```bash
mongosh "mongodb://localhost:27017/job_scheduler" db/init-mongo.js
```

Replace the URI with your Atlas connection string if using Atlas.

---

## 2. Run the API server

```bash
cd server
cp .env.example .env      # fill in MONGODB_URI, MONGODB_DB, and JWT_SECRET
npm install
npm run dev               # starts the REST API on http://localhost:4000
```

---

## 3. Run one or more workers

Workers are a **separate process** from the API server — that's what lets you
scale job execution independently of API traffic. Open a new terminal:

```bash
cd server
npm run worker            # WORKER_NAME defaults to worker-<hostname>-<pid>
```

Run it again in another terminal (optionally with `WORKER_NAME=worker-2 npm run worker`)
to see multiple workers picking up jobs without ever double-claiming the same one.
The atomic claim uses `findOneAndUpdate` with a `queued→claimed` status transition
— MongoDB's document-level locking makes this race-safe. See `docs/design-decisions.md`.

---

## 4. Run the dashboard

```bash
cd client
cp .env.example .env      # points to the API server, defaults to localhost:4000
npm install
npm run dev               # starts on http://localhost:5173
```

Open the dashboard, register an account (this also creates your first organization),
create a project, a queue, and a job — then watch a worker pick it up in real time
(the UI polls every 3–5 seconds).

---

## Trying it out quickly

Once you have a queue, the fastest way to see the whole lifecycle — including
retries and the dead letter queue — is to create a job with type
`fail_randomly` and `payload: { "fail_rate": 1 }`. Set the queue's retry
policy to a small number of attempts with a short delay, and watch it retry
before landing in the dead letter queue.

---

## Running tests

```bash
cd server
npm test
```

Covers the retry backoff math (fixed/linear/exponential, clamping, exhaustion)
and the job handler registry — the two pieces of logic most worth unit-testing
in isolation.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB` | `job_scheduler` | Database name |
| `JWT_SECRET` | *(required)* | Secret used to sign JWTs |
| `PORT` | `4000` | API server port |
| `WORKER_NAME` | `worker-<host>-<pid>` | Human-readable worker name |
| `WORKER_CONCURRENCY` | `5` | Max concurrent jobs per worker |
| `POLL_INTERVAL_MS` | `2000` | How often the worker polls for new jobs |
| `HEARTBEAT_INTERVAL_MS` | `5000` | How often the worker sends a heartbeat |

---

## Further reading

- [`docs/architecture.md`](docs/architecture.md) — system architecture diagram and component responsibilities
- [`docs/er-diagram.md`](docs/er-diagram.md) — entity-relationship diagram and schema notes
- [`docs/api.md`](docs/api.md) — full REST API reference
- [`docs/design-decisions.md`](docs/design-decisions.md) — trade-offs and why things are built this way

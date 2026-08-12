# Microserver API

A gateway plus independently deployable project APIs. Each project owns its source,
environment file, database connection, and (in Compose) its own MongoDB container
and persistent volume.

## Project layout

| Project     | Source                 | Direct port | Gateway prefix        | Database                            |
| ----------- | ---------------------- | ----------- | --------------------- | ----------------------------------- |
| Print3D Hub | `projects/print3d-hub` | 5001        | `/api/v1/print3d-hub` | `mongo-print3d-hub` / `print3d-hub` |
| Bynder      | `projects/bynder`      | 5002        | `/api/v1/bynder`      | `mongo-bynder` / `bynder`           |
| Bango       | `projects/bango`       | 5003        | `/api/v1/bango`       | `mongo-bango` / `bango`             |

The legacy project source was copied without existing secrets, dependency folders,
compiled files, uploaded Bynder media, or Bango's Firebase administrator key.

## Start

Requires Node.js 20.19+, 22.13+, or 24+; Node 22 LTS is configured in `.nvmrc`.

```sh
npm install
cp .env.example .env
cp projects/print3d-hub/.env.example projects/print3d-hub/.env
cp projects/bynder/.env.example projects/bynder/.env
cp projects/bango/.env.example projects/bango/.env
npm run dev
```

The gateway listens on `http://localhost:3000` by default. Install and run a
project directly with `npm --prefix projects/<project> install` and its matching
`npm run dev:<project>` command, or launch the complete stack with Compose.

| Endpoint                | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `GET /health`           | Liveness probe                                |
| `GET /health/ready`     | Readiness probe (returns 503 during shutdown) |
| `GET /api/v1`           | Versioned API entry point                     |
| `/api/v1/print3d-hub/*` | Print3D Hub API proxy                         |
| `/api/v1/bynder/*`      | Bynder API proxy                              |
| `/api/v1/bango/*`       | Bango API proxy                               |

## Configuration and data isolation

Each folder has its own `.env` (created from its `.env.example`) and keeps its
project-only credentials there. Replace the placeholder secrets before any
non-local deployment. `compose.yaml` assigns distinct local
MongoDB services and named volumes, so stopping or recreating one service does
not touch another project's data. Bynder uploads are also stored in the isolated
`bynder-images` volume. For production, replace each project's Mongo URI in its
own `.env` with a separate managed database URI.

## Quality checks

```sh
npm run check
npm run build
```

## Containers

```sh
docker compose up --build
```

Before the first Compose run, create the three project `.env` files using the
commands above. The Print3D image downloads Bambu Studio during its build, so it
is substantially slower than the other services.

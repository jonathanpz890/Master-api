# Microserver API

A single Express server that mounts each product as an isolated router. Product
logic lives under `src/services`; it has no runtime dependency on `projects/`.

## Project layout

| Project     | Public router                      | Service code               | Database      |
| ----------- | ---------------------------------- | -------------------------- | ------------- |
| Print3D Hub | `src/routes/print3d-hub.router.ts` | `src/services/print3d-hub` | `print3d-hub` |
| Bynder      | `src/routes/bynder.router.ts`      | `src/services/bynder`      | `bynder`      |
| Bango       | `src/routes/bango.router.ts`       | `src/services/bango`       | `bango`       |

`projects/` is now reference-only and can be removed after the migrated routes
have been validated against each client.

## Start

Requires Node.js 20.19+, 22.13+, or 24+; Node 22 LTS is configured in `.nvmrc`.

```sh
npm install
cp .env.example .env
npm run dev
```

The API listens on `http://localhost:3000`. Each namespace is mounted directly
in that same Node/Express process; there are no application proxy hops or project
ports.

MongoDB is the only external requirement. Set the three URI values in `.env` to
three separate local databases or managed MongoDB databases, then run the server
with Node 22:

```sh
nvm use
npm install
npm run dev
```

For a production build:

```sh
npm run build
npm start
```

| Endpoint                | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `GET /health`           | Liveness probe                                |
| `GET /health/ready`     | Readiness probe (returns 503 during shutdown) |
| `GET /api/v1`           | Versioned API entry point                     |
| `/api/v1/print3d-hub/*` | Print3D Hub router                            |
| `/api/v1/bynder/*`      | Bynder router                                 |
| `/api/v1/bango/*`       | Bango router                                  |

For example, a Bango endpoint formerly at `/user/...` is called through the
single public server as `/api/v1/bango/user/...`. Each router receives its
existing route path, so the migrated endpoint behavior stays unchanged.

On startup the server connects to all three databases in parallel. Check the
result before sending application traffic:

```sh
curl http://localhost:3000/health/ready
```

It returns `200` only when Print3D Hub, Bynder, and Bango are all connected.
The JSON response identifies any service that is still starting or failed.
While any database is unavailable, `/api/v1/*` returns `503` rather than
attempting reads or writes against a disconnected service.

## Configuration and data isolation

The root `.env` uses namespaced variables—`BLUEPRINT_*`, `BYNDER_*`, and
`BANGO_*`—so credentials and database URIs cannot collide. The three Mongoose
clients are isolated inside the process. Point each URI at a different MongoDB
database; for example, local MongoDB can use `print3d-hub`, `bynder`, and
`bango` databases on the same MongoDB instance. Print3D and Bynder files are
stored separately under `data/`.

## Quality checks

```sh
npm run check
npm run build
```

Replace the placeholder secrets in `.env` before deployment. Print3D slicing
also requires Bambu Studio at `BLUEPRINT_BAMBU_STUDIO_PATH`.

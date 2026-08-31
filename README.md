# Microserver API

A single Express server that mounts each product as an isolated router. Product
logic lives under `src/services`; it has no runtime dependency on `projects/`.

## Project layout

| Project     | Public router                      | Service code               | Database      |
| ----------- | ---------------------------------- | -------------------------- | ------------- |
| Print3D Hub | `src/routes/print3d-hub.router.ts` | `src/services/print3d-hub` | `print3d-hub` |
| Bynder      | `src/routes/bynder.router.ts`      | `src/services/bynder`      | `bynder`      |
| Bingory     | `src/routes/bingory.router.ts`     | `src/services/bingory`     | `bingory`     |

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
| `/api/v1/bingory/*`     | Bingory router                                |

### Bingory route reference

Every Bingory URL is below `/api/v1/bingory` and uses explicit resource names.
`GET /api/v1/bingory` returns this same route index as JSON.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Start a session |
| `GET` | `/auth/google` | Start Google sign-in |
| `GET` | `/auth/session` | Get the signed-in user |
| `POST` | `/auth/logout` | End the current session |
| `POST` | `/games` | Create a game |
| `GET` | `/games/:gameId` | Read a game |
| `POST` | `/games/join` | Add the signed-in user to a game |
| `GET` | `/users` | List Bingory users |
| `PATCH` | `/users` | Mark or unmark one of the signed-in user's squares |

For local development, Microserver API owns `http://localhost:3000` and the
Bingory React app runs on `http://localhost:3001`. The client calls the API at
`http://localhost:3000/api/v1/bingory`.
For a deployed Bingory client, add its exact HTTPS origin to `CORS_ORIGINS` in
the Microserver API environment.

Google sign-in additionally requires `BINGORY_GOOGLE_CLIENT_ID`,
`BINGORY_GOOGLE_CLIENT_SECRET`, `BINGORY_SERVER_URL`, and
`BINGORY_CLIENT_ORIGIN`. The callback registered with Google must be
`<BINGORY_SERVER_URL>/api/v1/bingory/auth/google/callback`.

On startup, Print3D Hub and Bynder connect in the background. Bingory connects
only when its namespace receives its first request, so a Bingory database issue
cannot prevent the other applications from serving traffic. Check the currently
available services with:

```sh
curl http://localhost:3000/health/ready
```

The JSON response identifies each service that is ready, starting, or failed.
Only requests routed to an unavailable service return `503`; unrelated service
namespaces stay available.

## Configuration and data isolation

The root `.env` uses namespaced variables—`BLUEPRINT_*`, `BYNDER_*`, and
`BINGORY_*`—so credentials and database URIs cannot collide. The three Mongoose
clients are isolated inside the process. Point each URI at a different MongoDB
database; for example, local MongoDB can use `print3d-hub`, `bynder`, and
`bingory` databases on the same MongoDB instance. Print3D and Bynder files are
stored separately under `data/`.

## Quality checks

```sh
npm run check
npm run build
```

Replace the placeholder secrets in `.env` before deployment. Print3D slicing
also requires Bambu Studio at `BLUEPRINT_BAMBU_STUDIO_PATH`.

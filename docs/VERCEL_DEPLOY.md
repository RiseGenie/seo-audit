# Deploying this SEOnaut fork with Vercel

SEOnaut is a stateful Go web server: it runs a background crawler with
long-lived worker goroutines and requires a MySQL database. None of that fits
Vercel's serverless model (short-lived, stateless functions with no
persistent processes and no database hosting), so the application itself
**cannot run directly on Vercel**.

Instead, this repo is split into two pieces:

1. **The SEOnaut app** (repo root — `cmd/`, `internal/`, `web/`, `migrations/`,
   `Dockerfile`, `docker-compose.yml`, ...) is the unmodified upstream
   application. It must run on a host that supports long-running containers
   and a MySQL database, using the Dockerfile/docker-compose already in this
   repo. Good options: [Railway](https://railway.app), [Fly.io](https://fly.io),
   [Render](https://render.com), or any VPS running `docker compose up`.
2. **`vercel-proxy/`** is a small reverse-proxy project that deploys to
   Vercel and forwards every request to the backend from step 1, so you get
   a `*.vercel.app` URL in front of the real app.

## 1. Deploy the SEOnaut backend

Deploy the repo root using its existing `Dockerfile`/`docker-compose.yml` to
a platform that provides an always-on container and a MySQL 8.4 database
(see the main [README](../README.md) and [docs/INSTALL.md](INSTALL.md) for
configuration details, e.g. `SEONAUT_DATABASE_*` / `SEONAUT_SERVER_*`
environment variables).

Once deployed, note the backend's public URL, e.g.
`https://seonaut-production.up.railway.app`. Make sure `SEONAUT_SERVER_URL`
on the backend is set to the URL you'll expose through Vercel (the vanity
domain), since SEOnaut uses it to build absolute links.

## 2. Deploy the Vercel proxy

1. In the Vercel dashboard, create a new project from this repository and
   set **Root Directory** to `vercel-proxy`.
2. Add an environment variable:
   - `SEONAUT_BACKEND_URL` = the backend URL from step 1 (no trailing slash),
     e.g. `https://seonaut-production.up.railway.app`
3. Deploy. Vercel builds nothing (there's no build step) and serves
   `vercel-proxy/api/proxy.js`, which forwards every request/response
   (including cookies, so login/sessions work) to the backend.

## Limitations of the proxy approach

- Request/response bodies are buffered in the serverless function, subject
  to Vercel's function payload limits (4.5 MB by default), which can affect
  large CSV/sitemap exports or imports.
- Function execution time is capped by your Vercel plan (`maxDuration` is set
  to 30s in `vercel-proxy/vercel.json`'s function config); this only affects
  the proxied request/response round-trip, not the crawler itself, which
  runs entirely on the backend independent of any Vercel request.
- Vercel authentication/deployment protection (if enabled on the project)
  will intercept requests before they reach the proxy; keep it disabled for
  a publicly usable app.

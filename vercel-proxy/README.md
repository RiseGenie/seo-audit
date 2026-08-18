# vercel-proxy

A minimal Vercel project that reverse-proxies all requests to an externally
hosted SEOnaut backend, since SEOnaut's crawler and MySQL dependency can't
run on Vercel's serverless platform.

See [`../docs/VERCEL_DEPLOY.md`](../docs/VERCEL_DEPLOY.md) for full setup
instructions.

Required environment variable: `SEONAUT_BACKEND_URL` — the origin of the
deployed SEOnaut backend (e.g. `https://seonaut-production.up.railway.app`).

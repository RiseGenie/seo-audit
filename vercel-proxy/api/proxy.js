// Reverse-proxies every request to an externally hosted SEOnaut instance
// (the Go server + MySQL backend, deployed separately since Vercel cannot
// run SEOnaut's long-running crawler workers or host MySQL).
//
// Required environment variable (set in the Vercel project settings):
//   SEONAUT_BACKEND_URL - origin of the backend, e.g. https://seonaut.up.railway.app

export const config = {
  maxDuration: 30,
};

const HOP_BY_HOP_REQUEST_HEADERS = new Set(['host', 'connection', 'content-length']);
const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'set-cookie',
]);

export default async function handler(req, res) {
  const backendOrigin = process.env.SEONAUT_BACKEND_URL;
  if (!backendOrigin) {
    res.statusCode = 500;
    res.end('SEONAUT_BACKEND_URL environment variable is not set.');
    return;
  }

  const { path, ...rest } = req.query;
  const targetPath = Array.isArray(path) ? path.join('/') : path || '';

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) {
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, v));
    } else if (value !== undefined) {
      search.append(key, value);
    }
  }
  const qs = search.toString();
  const targetUrl = `${backendOrigin.replace(/\/$/, '')}/${targetPath}${qs ? `?${qs}` : ''}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase()) || value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  headers.set('x-forwarded-host', req.headers.host || '');
  headers.set('x-forwarded-proto', 'https');

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  const backendResponse = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
  });

  res.statusCode = backendResponse.status;
  backendResponse.headers.forEach((value, key) => {
    if (HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
    res.setHeader(key, value);
  });

  const setCookies = backendResponse.headers.getSetCookie?.();
  if (setCookies?.length) {
    res.setHeader('set-cookie', setCookies);
  }

  const arrayBuffer = await backendResponse.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

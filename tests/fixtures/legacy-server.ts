import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { timingSafeEqual, createHash } from 'node:crypto';
import { generateDemo, devices, locations } from './demo';
import {
  type Observation,
  SCENARIO_CLOCK,
  DEFAULT_FRESH_MINUTES,
} from '../../lib/rutems/domain';
import {
  validateObservation,
  duplicateKey,
  MAX_BATCH,
  MAX_BYTES,
} from '../../lib/rutems/validation';
const port = Number(process.env.RUTEMS_API_PORT || 8788),
  dir = resolve(process.env.RUTEMS_DATA_DIR || '.rutems-data');
mkdirSync(dir, { recursive: true });
const enabled = process.env.RUTEMS_ENABLE_REAL_INGESTION === 'true';
const realDevices: { id: string; locationId: string; token: string }[] =
  JSON.parse(process.env.RUTEMS_DEVICE_CONFIG || '[]');
if (
  enabled &&
  (!Array.isArray(realDevices) ||
    !realDevices.length ||
    realDevices.some(
      (d) =>
        !d.id ||
        typeof d.token !== 'string' ||
        d.token.length < 32 ||
        !locations.some((l) => l.id === d.locationId),
    ) ||
    new Set(realDevices.map((d) => d.id)).size !== realDevices.length ||
    new Set(realDevices.map((d) => d.token)).size !== realDevices.length)
)
  throw Error(
    'Real ingestion requires unique registered devices and unique tokens of at least 32 characters',
  );
const read = (mode: string): Observation[] => {
  try {
    return JSON.parse(readFileSync(resolve(dir, mode + '.json'), 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
};
const stores = { demo: read('demo'), real: read('real') };
const save = (mode: 'demo' | 'real') => {
  const path = resolve(dir, mode + '.json');
  writeFileSync(path + '.tmp', JSON.stringify(stores[mode]), { mode: 0o600 });
  renameSync(path + '.tmp', path);
};
const equal = (a: string, b: string) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status: number, data: unknown) => {
    res.writeHead(status);
    res.end(JSON.stringify(data));
  };
  if (
    !['localhost', '127.0.0.1'].includes((req.headers.host || '').split(':')[0])
  )
    return send(403, { error: 'Local service only' });
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin))
    return send(403, { error: 'Origin not allowed' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Device-Id',
    );
    return send(204, null);
  }
  const url = new URL(req.url || '/', 'http://localhost');
  const requestedMode = url.searchParams.get('mode');
  if (requestedMode && !['demo', 'real'].includes(requestedMode))
    return send(400, { error: 'Unknown data mode' });
  const mode = requestedMode === 'real' ? 'real' : 'demo';
  try {
    if (req.method === 'GET' && url.pathname === '/api/health')
      return send(200, {
        status: 'ok',
        scope: 'local demonstrator',
        realConfigured: enabled,
      });
    if (req.method === 'GET' && url.pathname === '/api/data') {
      if (mode === 'real' && !enabled)
        return send(503, {
          error:
            'Real device connection not configured. No observations available.',
        });
      const seed = generateDemo();
      const clock = mode === 'demo' ? SCENARIO_CLOCK : new Date().toISOString();
      const locs =
        mode === 'demo'
          ? locations
          : locations.filter((l) =>
              realDevices.some((d) => d.locationId === l.id),
            );
      return send(200, {
        mode,
        clock,
        start:
          mode === 'demo'
            ? seed.start
            : new Date(Date.now() - 7 * 86400000).toISOString(),
        freshMinutes:
          Number(process.env.RUTEMS_FRESH_MINUTES) || DEFAULT_FRESH_MINUTES,
        locations: locs,
        observations: [
          ...(mode === 'demo' ? seed.observations : []),
          ...stores[mode],
        ].map((o) => {
          const l = locs.find((l) => l.id === o.locationId)!;
          return {
            ...o,
            id:
              mode === 'demo'
                ? o.id
                : 'obs-' +
                  createHash('sha256')
                    .update(o.deviceId + '|' + o.id)
                    .digest('hex')
                    .slice(0, 24),
            deviceId: mode === 'demo' ? o.deviceId : 'public-' + l.id,
            lat: l.lat,
            lng: l.lng,
            uncertaintyM: Math.max(l.uncertaintyM, o.uncertaintyM),
          };
        }),
      });
    }
    if (url.pathname.startsWith('/api/operator'))
      return send(403, {
        error:
          'Real operator operations are disabled. Demo workspace uses browser-local synthetic records.',
      });
    if (req.method === 'POST' && url.pathname === '/api/demo/reset') {
      if (req.headers.authorization !== 'Bearer local-demo-only')
        return send(401, { error: 'Demo token required' });
      const prior = stores.demo;
      stores.demo = [];
      try {
        save('demo');
      } catch (e) {
        stores.demo = prior;
        throw e;
      }
      return send(200, { reset: true });
    }
    if (req.method !== 'POST' || url.pathname !== '/api/ingest')
      return send(404, { error: 'Not found' });
    if (mode === 'real' && !enabled)
      return send(403, { error: 'Real ingestion is disabled' });
    const deviceId = req.headers['x-device-id'];
    const device =
      mode === 'demo'
        ? devices.find((d) => d.id === deviceId)
        : realDevices.find((d) => d.id === deviceId);
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const expected =
      mode === 'demo'
        ? 'local-demo-only'
        : realDevices.find((d) => d.id === deviceId)?.token;
    if (!device || !expected || !equal(token, expected))
      return send(401, { error: 'Unauthorized device' });
    if (!req.headers['content-type']?.startsWith('application/json'))
      return send(415, { error: 'application/json required' });
    let body = '';
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES)
        return send(413, { error: 'Payload exceeds 64 KiB' });
      body += chunk.toString();
    }
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return send(400, { error: 'Invalid JSON' });
    }
    if (
      !payload ||
      typeof payload !== 'object' ||
      !Array.isArray(payload.observations) ||
      !payload.observations.length ||
      payload.observations.length > MAX_BATCH
    )
      return send(400, { error: 'Batch must contain 1–100 observations' });
    const accepted: string[] = [],
      duplicates: string[] = [],
      rejected: { index: number; reason: string }[] = [];
    const clock = mode === 'demo' ? SCENARIO_CLOCK : new Date().toISOString();
    const location = locations.find((l) => l.id === device.locationId)!;
    const existing = [
      ...(mode === 'demo' ? generateDemo().observations : []),
      ...stores[mode],
    ];
    const keys = new Set(existing.map(duplicateKey)),
      ids = new Set(existing.map((o) => o.deviceId + '|' + o.id));
    const priorLength = stores[mode].length;
    payload.observations.forEach((raw: unknown, index: number) => {
      const o = validateObservation(
        raw,
        device,
        location,
        clock,
        mode === 'demo',
      );
      if (typeof o === 'string') {
        rejected.push({ index, reason: o });
        return;
      }
      if (keys.has(duplicateKey(o)) || ids.has(o.deviceId + '|' + o.id)) {
        duplicates.push(o.id);
        return;
      }
      stores[mode].push(o);
      keys.add(duplicateKey(o));
      ids.add(o.deviceId + '|' + o.id);
      accepted.push(o.id);
    });
    if (accepted.length) {
      try {
        save(mode);
      } catch (e) {
        stores[mode].length = priorLength;
        throw e;
      }
    }
    return send(
      rejected.length && !accepted.length && !duplicates.length ? 422 : 200,
      { accepted, duplicates, rejected, mode },
    );
  } catch {
    send(500, {
      error: 'Data service failed. Observations were not substituted.',
    });
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(
    `RUTEMS local API: http://127.0.0.1:${port} · real ingestion ${enabled ? 'configured' : 'disabled'}`,
  ),
);

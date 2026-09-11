import { readFileSync } from 'node:fs';
const payload = readFileSync(
  new URL('./esp32-demo-batch.json', import.meta.url),
  'utf8',
);
const response = await fetch('http://127.0.0.1:8788/api/ingest?mode=demo', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer local-demo-only',
    'X-Device-Id': 'demo-lodhi-garden',
  },
  body: payload,
});
console.log(response.status, await response.json());
if (!response.ok) process.exitCode = 1;

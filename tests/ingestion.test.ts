import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { controlledObservation } from './fixtures/demo';
async function service(port: number, real = false) {
  const dir = await mkdtemp(join(tmpdir(), 'rutems-test-'));
  const token = 'test-only-device-secret-32-characters-long';
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'tests/fixtures/legacy-server.ts'],
    {
      env: {
        ...process.env,
        RUTEMS_API_PORT: String(port),
        RUTEMS_DATA_DIR: dir,
        RUTEMS_ENABLE_REAL_INGESTION: String(real),
        RUTEMS_DEVICE_CONFIG: JSON.stringify([
          { id: 'esp32-test', locationId: 'lodhi-garden', token },
        ]),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  await new Promise<void>((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('RUTEMS local API')) resolve();
    });
    child.once('error', reject);
    child.once('exit', (code) => reject(Error(`Server exited ${code}`)));
  });
  return {
    url: `http://127.0.0.1:${port}`,
    token,
    stop: async () => {
      child.kill();
      await new Promise((r) => child.once('exit', r));
      await rm(dir, { recursive: true, force: true });
    },
  };
}
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer local-demo-only',
  'X-Device-Id': 'demo-lodhi-garden',
};
void test('local batch ingestion enforces authorization, limits, duplicate handling and public-view consistency', async () => {
  const s = await service(8789);
  try {
    const post = (body: unknown, h = headers, mode = 'demo') =>
      fetch(s.url + '/api/ingest?mode=' + mode, {
        method: 'POST',
        headers: h,
        body: JSON.stringify(body),
      });
    assert.equal(
      (
        await post(
          { observations: [controlledObservation()] },
          { ...headers, Authorization: 'Bearer wrong' },
        )
      ).status,
      401,
    );
    assert.equal(
      (await post({ observations: [controlledObservation()] }, headers, 'real'))
        .status,
      403,
    );
    assert.equal((await fetch(s.url + '/api/data?mode=real')).status, 503);
    assert.equal((await fetch(s.url + '/api/operator')).status, 403);
    assert.equal((await post(null)).status, 400);
    assert.equal(
      (await post({ observations: Array(101).fill(controlledObservation()) }))
        .status,
      400,
    );
    assert.equal(
      (await post({ observations: [], padding: 'x'.repeat(66000) })).status,
      413,
    );
    assert.equal(
      (
        await post(
          { observations: [controlledObservation()] },
          { ...headers, Origin: 'https://untrusted.example' },
        )
      ).status,
      403,
    );
    const first = await post({ observations: [controlledObservation()] });
    assert.equal(first.status, 200);
    assert.equal(
      ((await first.json()) as { accepted: string[] }).accepted.length,
      1,
    );
    const duplicate = await post({ observations: [controlledObservation()] });
    assert.equal(
      ((await duplicate.json()) as { duplicates: string[] }).duplicates.length,
      1,
    );
    const invalid = await post({
      observations: [
        {
          ...controlledObservation(),
          id: 'bad-reading',
          raw: { ...controlledObservation().raw, humidity: 150 },
        },
      ],
    });
    assert.equal(invalid.status, 422);
    const snapshot = (await fetch(s.url + '/api/data').then((r) =>
      r.json(),
    )) as {
      observations: {
        id: string;
        raw: { pm25: number };
        measuredAt: string;
        locationId: string;
      }[];
    };
    const found = snapshot.observations.find(
      (o) => o.id === controlledObservation().id,
    );
    assert.equal(found?.raw.pm25, 72.2);
    assert.equal(found?.locationId, 'lodhi-garden');
    assert.equal(found?.measuredAt, controlledObservation().measuredAt);
  } finally {
    await s.stop();
  }
});
void test('configured real mode authenticates each device, preserves delayed timestamps, and never includes demo rows', async () => {
  const s = await service(8790, true);
  try {
    const measuredAt = new Date(Date.now() - 2 * 3600000).toISOString();
    const o = { ...controlledObservation(), id: 'real-test', measuredAt };
    const post = (token: string) =>
      fetch(s.url + '/api/ingest?mode=real', {
        method: 'POST',
        headers: {
          ...headers,
          'X-Device-Id': 'esp32-test',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ observations: [o] }),
      });
    assert.equal((await post('wrong')).status, 401);
    assert.equal((await post(s.token)).status, 200);
    const snapshot = (await fetch(s.url + '/api/data?mode=real').then((r) =>
      r.json(),
    )) as {
      observations: {
        demo: boolean;
        measuredAt: string;
        receivedAt: string;
        deviceId: string;
      }[];
    };
    assert.equal(snapshot.observations.length, 1);
    assert.equal(snapshot.observations[0].demo, false);
    assert.equal(snapshot.observations[0].measuredAt, measuredAt);
    assert.ok(snapshot.observations[0].receivedAt > measuredAt);
    assert.equal(snapshot.observations[0].deviceId, 'public-lodhi-garden');
    assert.doesNotMatch(JSON.stringify(snapshot), new RegExp(s.token));
  } finally {
    await s.stop();
  }
});

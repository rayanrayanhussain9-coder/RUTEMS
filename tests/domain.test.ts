import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDemo,
  controlledObservation,
  devices,
  locations,
} from './fixtures/demo';
import {
  latest,
  freshness,
  series,
  summary,
  evaluateWatch,
  valueOf,
  observationsCSV,
  SCENARIO_CLOCK,
  type Watch,
} from '../lib/rutems/domain';
import { validateObservation } from '../lib/rutems/validation';
const data = generateDemo();
void test('demo is deterministic; all measurement and receive times respect the shared clock', () => {
  assert.deepEqual(generateDemo(), data);
  assert.equal(data.locations.length, 8);
  assert.ok(
    data.observations.every(
      (o) => o.measuredAt <= o.receivedAt && o.receivedAt <= data.clock,
    ),
  );
});
void test('recent, stale, invalid, unavailable and missing metrics are distinct', () => {
  assert.equal(freshness(latest(data.observations, 'lodhi-garden')), 'Recent');
  assert.equal(freshness(latest(data.observations, 'india-gate')), 'Stale');
  assert.equal(freshness(latest(data.observations, 'yamuna-edge')), 'Invalid');
  assert.equal(
    freshness(latest(data.observations, 'george-everest')),
    'Unavailable',
  );
  assert.equal(valueOf(latest(data.observations, 'yamuna-edge'), 'pm25'), null);
  assert.equal(valueOf(latest(data.observations, 'camel-back'), 'pm10'), null);
  const o = latest(data.observations, 'lodhi-garden')!;
  assert.equal(valueOf({ ...o, raw: { ...o.raw, uv: 0 } }, 'uv'), 0);
});
void test('history contains explicit gaps and hourly coverage is not inflated by repeated records', () => {
  const s = series(data.observations, 'lodhi-garden', 'pm25', 168);
  assert.equal(s.length, 168);
  assert.equal(s.filter((x) => x.value === null).length, 7);
  const o = latest(data.observations, 'lodhi-garden')!;
  assert.deepEqual(
    summary([...data.observations, o, o], 'lodhi-garden', 'pm25', 24),
    summary(data.observations, 'lodhi-garden', 'pm25', 24),
  );
});
void test('watches require recent, valid and covered observations; controlled eligible data triggers', () => {
  const w: Watch = {
    id: 'test',
    locationId: 'lodhi-garden',
    metric: 'pm25',
    threshold: 50,
    hours: 1,
  };
  assert.equal(evaluateWatch(w, data).notice, undefined);
  for (const id of [
    'india-gate',
    'yamuna-edge',
    'central-delhi',
    'george-everest',
  ]) {
    const r = evaluateWatch({ ...w, locationId: id, threshold: 0 }, data);
    assert.match(r.state, /Not evaluated/);
    assert.equal(r.notice, undefined);
  }
  const validated = validateObservation(
    controlledObservation(),
    devices[0],
    locations[0],
    SCENARIO_CLOCK,
    true,
  );
  assert.notEqual(typeof validated, 'string');
  if (typeof validated === 'string') return;
  const next = { ...data, observations: [...data.observations, validated] };
  assert.equal(evaluateWatch(w, next).notice?.value, 72.2);
  assert.equal(
    summary(next.observations, 'lodhi-garden', 'pm25', 24).count,
    24,
  );
});
void test('validation rejects future, missing keys, invalid ranges, flag inconsistencies and invented corrections', () => {
  const base = controlledObservation();
  for (const change of [
    { measuredAt: '2026-09-10T06:30:00.000Z' },
    { raw: { pm25: 2 } },
    { raw: { ...base.raw, humidity: 101 } },
    { raw: { ...base.raw, pm25: '2' } },
    { flags: ['placement_review'] },
    { lat: 0 },
    { averagingSeconds: 60 },
    { quality: 'invalid' },
    { raw: { ...base.raw, uv: null }, corrected: base.raw },
  ])
    assert.equal(
      typeof validateObservation(
        { ...base, ...change },
        devices[0],
        locations[0],
        SCENARIO_CLOCK,
        true,
      ),
      'string',
    );
});
void test('CSV preserves raw invalid readings, nulls and zero, with units, quality and mode; excludes positions and device identity', () => {
  const invalid = latest(data.observations, 'yamuna-edge')!;
  const text = observationsCSV([invalid], locations);
  assert.match(text, /pm25 \[µg\/m³\]/);
  assert.match(text, /"-8"/);
  assert.match(text, /"invalid"/);
  assert.match(text, /"fictional demo"/);
  assert.doesNotMatch(text, /device_id|latitude|longitude|demo-yamuna/);
});

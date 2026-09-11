import { test } from 'node:test';
import assert from 'node:assert/strict';
import { averagingLabel, history } from '../lib/rutems/domain';
import { generateDemo } from './fixtures/demo';
void test('short device intervals are never presented or counted as hourly averages', () => {
  assert.equal(averagingLabel(60), '1-minute average');
  assert.equal(averagingLabel(10), '10-second average');
  assert.equal(averagingLabel(3600), '1-hour average');
  const data = generateDemo();
  const row = { ...data.observations[0], averagingSeconds: 60 };
  assert.equal(history([row], row.locationId, 168, data.clock).length, 0);
});

import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const api = 'http://127.0.0.1:8788';
async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function listMode(page: Page) {
  await expect(page.locator('.explore-layout')).toBeVisible();
  const list = page.getByRole('tab', { name: 'List', exact: true });
  if (await list.isVisible()) await list.click();
}
test.beforeEach(async ({ page, request }) => {
  await request.post(api + '/api/demo/reset', {
    headers: { Authorization: 'Bearer local-demo-only' },
  });
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  );
});
test('home → explore → filter/search → location → 7-day history, gaps and CSV', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: 'Your environment. Closer to the ground.',
    }),
  ).toBeVisible();
  await expect(page.locator('.hero-map-reading strong')).toContainText('42.6');
  await expect(page.locator('.home-map-empty')).toHaveCount(0);
  await page.screenshot({
    path: `test-results/${info.project.name}-home.png`,
    fullPage: true,
  });
  await page
    .getByRole('link', { name: 'Explore demo map', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Search demo locations' }),
  ).toBeVisible();
  await listMode(page);
  await choose(page, 'Freshness', 'Stale');
  await expect(
    page.getByRole('button', {
      name: 'Select India Gate precinct',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Select Lodhi Garden', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page
    .getByRole('textbox', { name: 'Search demo locations' })
    .fill('Landour');
  await page
    .getByRole('button', { name: 'Select Landour ridge', exact: true })
    .click();
  await page.getByRole('link', { name: 'History, data & downloads' }).click();
  await expect(page).toHaveURL(/locations\/landour-ridge/);
  await page.getByRole('tab', { name: '7 days', exact: true }).click();
  await page.getByRole('tab', { name: 'Data table', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('Page 1 of 7')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const file = await downloadPromise;
  const content = await readFile((await file.path())!, 'utf8');
  expect(file.suggestedFilename()).toContain('168h-demo');
  expect(content).toContain('pm25 [µg/m³]');
  expect(content).toContain('fictional demo');
  expect(content).toContain('Landour ridge');
  expect(content).toContain('2026-09-09T06:25:00.000Z');
  expect(content).not.toMatch(/latitude|longitude|device_id/);
  expect(content.split('\r\n').length).toBe(162);
  expect(errors).toEqual([]);
});
test('save, reload, review Saved Places and remove', async ({ page }) => {
  await page.goto('/locations/lodhi-garden');
  await page.getByRole('button', { name: 'Save place', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Saved', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Saved', exact: true }),
  ).toBeVisible();
  await page.goto('/saved');
  await expect(
    page.getByRole('button', { name: 'Unsave Lodhi Garden' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Unsave Lodhi Garden' }).click();
  await page.reload();
  await expect(
    page.getByText('Your places will feel at home here.'),
  ).toBeVisible();
});
test('compare consistent windows and metrics, remove and clear', async ({
  page,
}) => {
  await page.goto('/compare');
  await choose(page, 'Add a location', 'Lodhi Garden');
  await choose(page, 'Add a location', 'Landour ridge');
  await expect(page.locator('.comparison-card')).toHaveCount(2);
  await page.getByRole('tab', { name: '7 days', exact: true }).click();
  await choose(page, 'Measurement', 'Temperature · °C');
  await expect(page.locator('.comparison-card').first()).toContainText(
    '161/168 hours',
  );
  await expect(
    page.getByText('All summaries use the same window', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Remove Landour ridge' }).click();
  await expect(
    page.getByText('Add another place to compare two or three locations.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear comparison' }).click();
  await expect(
    page.getByText('A little perspective starts with two places.'),
  ).toBeVisible();
});
test('create watch, ingest controlled eligible observation, notice and acknowledge', async ({
  page,
}) => {
  await page.goto('/saved');
  await page.getByRole('button', { name: 'Create watch' }).click();
  await expect(
    page.getByText('Below your threshold · evaluated observation only'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Load demo observation' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Lodhi Garden · Custom threshold exceeded',
    }),
  ).toBeVisible();
  await expect(page.locator('.notice-list')).toContainText('70.0 µg/m³');
  await page.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Acknowledged', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Clear acknowledged' }).click();
  await page.reload();
  await expect(
    page.getByText('No threshold events recorded.', { exact: true }),
  ).toBeVisible();
  await page.goto('/locations/lodhi-garden');
  await expect(page.locator('.metric-card').first()).toContainText('70.0');
  const dlPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const dl = await dlPromise;
  expect(await readFile((await dl.path())!, 'utf8')).toContain(
    'controlled-lodhi-garden-pm25-70',
  );
});
test('stale, invalid and unavailable never imply current favourable conditions', async ({
  page,
}) => {
  await page.goto('/locations/india-gate');
  await expect(page.getByText('Stale', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Historical reading, not current conditions/),
  ).toBeVisible();
  await page.goto('/locations/yamuna-edge');
  await expect(page.locator('.metric-card').first()).toContainText('—');
  await expect(
    page.getByText('Invalid · rejected', { exact: true }),
  ).toBeVisible();
  await page.goto('/locations/george-everest');
  await expect(page.getByText('No observations received')).toBeVisible();
  await expect(page.locator('.metric-card').first()).toContainText(
    'Measurement unavailable',
  );
});
test('operator maintenance persistence, issue acknowledgement and resolution history', async ({
  page,
}) => {
  await page.goto('/operator');
  await page
    .getByLabel('Maintenance note', { exact: true })
    .fill('Synthetic inspection: cleaned inlet; reference check pending.');
  await page.getByRole('button', { name: 'Save maintenance note' }).click();
  await page.reload();
  await expect(
    page.getByText(
      'Synthetic inspection: cleaned inlet; reference check pending.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Quality & issues' }).click();
  await page.getByRole('button', { name: 'Acknowledge issue' }).first().click();
  await expect(page.getByText('Acknowledged', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark resolved' }).first().click();
  await page.getByRole('tab', { name: 'Resolution history' }).click();
  await expect(
    page.getByText(
      'Demo issue marked resolved. Field verification is still required before real use.',
    ),
  ).toBeVisible();
});
test('map failure retains usable list; real and failed data services never substitute demo', async ({
  page,
}) => {
  await page.goto('/explore');
  await expect(
    page.getByText(/Map tiles unavailable or incomplete/),
  ).toBeVisible();
  await listMode(page);
  await page
    .getByRole('button', { name: 'Select Lodhi Garden', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'History, data & downloads' }),
  ).toBeVisible();
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible()) await close.click();
  await choose(page, 'Data mode', 'Connected devices');
  await expect(
    page.getByText(
      'Real device connection not configured. No observations available.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Select Lodhi Garden', exact: true }),
  ).toHaveCount(0);
  await choose(page, 'Data mode', 'Demo data');
  await expect(
    page.getByRole('button', { name: 'Select Lodhi Garden', exact: true }),
  ).toHaveCount(1);
  await page.route('**/api/data?mode=demo', (r) =>
    r.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Controlled test outage' }),
    }),
  );
  await page.reload();
  await expect(page.getByText('Controlled test outage')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Select Lodhi Garden', exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/data?mode=demo');
  await page.getByRole('button', { name: 'Retry connection' }).click();
  await expect(page.getByRole('tab', { name: 'Delhi · Urban' })).toBeVisible();
  await expect(page.locator('.explore-layout')).toBeVisible();
  await listMode(page);
  await expect(
    page.getByRole('button', { name: 'Select Lodhi Garden', exact: true }),
  ).toHaveCount(1);
});
test('navigation, keyboard focus and responsive pages', async ({
  page,
}, info) => {
  for (const path of [
    '/',
    '/explore',
    '/compare',
    '/saved',
    '/how-it-works',
    '/methods',
    '/privacy',
    '/operator',
    '/locations/lodhi-garden',
  ]) {
    await page.goto(path);
    await expect(page.locator('main')).not.toBeEmpty();
    await expect(page.locator('h1,h2').first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `No horizontal overflow at ${path}`,
    ).toBe(true);
  }
  await page.goto('/explore');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeInViewport();
  await expect(page.locator('.explore-layout')).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-explore.png`,
    fullPage: true,
  });
});

test('keyboard marker selection opens the same location details', async ({
  page,
}, info) => {
  await page.goto('/explore');
  const marker = page.getByRole('button', {
    name: 'India Gate precinct: 48.1 µg/m³, Stale',
    exact: true,
  });
  await marker.focus();
  await page.keyboard.press('Enter');
  await expect(
    page
      .locator('.location-details')
      .getByRole('heading', { name: 'India Gate precinct', exact: true }),
  ).toBeVisible();
  if (info.project.name === 'mobile') {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await listMode(page);
  }
  await page
    .getByRole('button', { name: 'Select Lodhi Garden', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page
      .locator('.location-details')
      .getByRole('heading', { name: 'Lodhi Garden', exact: true }),
  ).toBeVisible();
});

test('refresh shows an externally ingested observation without reloading', async ({
  page,
  request,
}) => {
  await page.goto('/locations/lodhi-garden');
  const reading = page.locator('.metric-card').filter({ hasText: 'PM2.5' });
  await expect(reading).toContainText('42.6');
  const payload = JSON.parse(
    await readFile('tests/fixtures/esp32-demo-batch.json', 'utf8'),
  );
  const response = await request.post(api + '/api/ingest?mode=demo', {
    headers: {
      Authorization: 'Bearer local-demo-only',
      'X-Device-Id': 'demo-lodhi-garden',
    },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Refresh observations' }).click();
  await expect(reading).toContainText('72.2');
  await expect(
    page.getByRole('button', { name: 'Refresh observations' }),
  ).toBeEnabled();
});

test('a superseded response cannot replace newer observations', async ({
  page,
  request,
}) => {
  const baseline = await (
    await request.get(api + '/api/data?mode=demo')
  ).json();
  await page.goto('/locations/lodhi-garden');
  const reading = page.locator('.metric-card').filter({ hasText: 'PM2.5' });
  await expect(reading).toContainText('42.6');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  let calls = 0;
  await page.route('**/api/data?mode=demo', async (route) => {
    calls += 1;
    if (calls === 1) {
      started();
      await held;
      await route.fulfill({ json: baseline }).catch(() => {});
    } else {
      const next = structuredClone(baseline);
      for (const observation of next.observations) {
        if (observation.locationId === 'lodhi-garden') {
          observation.raw.pm25 = 81.5;
          if (observation.corrected) observation.corrected.pm25 = 81.5;
        }
      }
      await route.fulfill({ json: next });
    }
  });
  await page.getByRole('button', { name: 'Refresh observations' }).click();
  await pending;
  await expect(
    page.getByRole('button', { name: 'Refresh observations' }),
  ).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(reading).toContainText('81.5');
  release();
  await expect(
    page.getByRole('button', { name: 'Refresh observations' }),
  ).toBeEnabled();
  await expect(reading).toContainText('81.5');
});

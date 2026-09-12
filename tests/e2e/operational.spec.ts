import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort());
});
test('real empty explorer has no synthetic records or demo controls', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/explore');
  await expect(
    page.getByText('No published observation areas yet.'),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.explore-layout')).toBeVisible({ timeout: 15000 });
  const list = page.getByRole('tab', { name: 'List', exact: true });
  if (await list.isVisible()) await list.click();
  await expect(
    page.getByRole('heading', { name: 'Observations 0' }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Search observation areas' }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Data mode' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Select Lodhi Garden' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh observations' }).click();
  await expect(
    page.getByRole('button', { name: 'Refresh observations' }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
test('operator routes require sign-in and login forms are accessible', async ({
  page,
}) => {
  await page.goto('/operator');
  await expect(
    page.getByRole('heading', { name: 'Staff sign-in required' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Sign in to open the Operator Workspace' })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Email', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Create account' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Forgot password' }).click();
  await expect(
    page.getByRole('heading', { name: 'Reset password' }),
  ).toBeVisible();
  // No account creation or email-sending action is submitted in this test.
});
test('public navigation and mobile layout remain usable', async ({ page }) => {
  for (const route of [
    '/',
    '/explore',
    '/compare',
    '/saved',
    '/how-it-works',
    '/methods',
    '/privacy',
    '/login',
    '/operator',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading').first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBeTruthy();
    await expect(
      page.getByText('Load demo observation', { exact: true }),
    ).toHaveCount(0);
  }
});
test('service failure stays unavailable without demo substitution', async ({
  page,
}) => {
  await page.route('**/rest/v1/rpc/public_snapshot', (r) =>
    r.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Verification service failure' }),
    }),
  );
  await page.goto('/explore');
  await expect(
    page.getByRole('heading', { name: 'Observations unavailable' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Select Lodhi Garden' }),
  ).toHaveCount(0);
  await page.unroute('**/rest/v1/rpc/public_snapshot');
  await page.getByRole('button', { name: 'Retry connection' }).click();
  await expect(
    page.getByText('No published observation areas yet.'),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.explore-layout')).toBeVisible({ timeout: 15000 });
});

test('sign-in submits and reports authentication failures', async ({
  page,
}) => {
  await page.route('**/auth/v1/token?grant_type=password', (r) =>
    r.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
      }),
    }),
  );
  await page.goto('/login');
  await page
    .getByLabel('Email', { exact: true })
    .fill('verification@example.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill('not-a-real-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.form-feedback')).toContainText(
    'Invalid login credentials',
  );
});

test('one-minute observations display their real interval without invented hourly history', async ({
  page,
}) => {
  const at = new Date(Date.now() - 60000).toISOString();
  const id = '00000000-0000-4000-8000-000000000099';
  const area = {
    id,
    name: 'Browser-only verification area',
    region: 'Verification',
    context: 'urban',
    source: 'fixed',
    lat: 28,
    lng: 77,
    uncertaintyM: 100,
    description: 'Browser test only',
  };
  const snapshot = {
    mode: 'real',
    clock: new Date().toISOString(),
    start: new Date(Date.now() - 7 * 86400000).toISOString(),
    freshMinutes: 90,
    locations: [area],
    observations: [
      {
        id: 'browser-test-reading',
        deviceId: 'public-area-' + id,
        locationId: id,
        measuredAt: at,
        receivedAt: at,
        averagingSeconds: 60,
        raw: {
          pm25: 25,
          pm10: 35,
          temperature: 23,
          humidity: 40,
          pressure: 1000,
          uv: 1,
        },
        corrected: null,
        quality: 'valid',
        flags: [],
        calibrationVersion: 'test',
        demo: false,
        lat: 28,
        lng: 77,
        uncertaintyM: 100,
      },
    ],
  };
  await page.route('**/rest/v1/rpc/public_snapshot', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot),
    }),
  );
  await page.goto('/locations/' + id);
  await expect(page.locator('.metric-card').first()).toContainText(
    '1-minute average',
  );
  await expect(page.locator('.metric-card').first()).toContainText('25.0');
  await expect(page.getByText('0 of 24 shared hourly intervals')).toBeVisible();
});

for (const staffRole of ['operator', 'admin']) {
  test(`${staffRole} forms register a device and persist notes through the data interface`, async ({
    page,
  }) => {
    // Isolated browser contract test: intercept ALL calls to Supabase. No cloud records are written.
    const uid = '00000000-0000-4000-8000-000000000011';
    const areaId = '00000000-0000-4000-8000-000000000012';
    const deviceId = '00000000-0000-4000-8000-000000000013';
    const user = {
      id: uid,
      email: 'operator@example.test',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
      factors: [],
    };
    const payload = {
      sub: uid,
      role: 'authenticated',
      aal: staffRole === 'admin' ? 'aal2' : 'aal1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token =
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
        'base64url',
      ) +
      '.' +
      Buffer.from(JSON.stringify(payload)).toString('base64url') +
      '.test-signature';
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem(
          'sb-vgenmqsxdqtepiugcznf-auth-token',
          JSON.stringify({
            access_token: token,
            refresh_token: 'test-refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: 'bearer',
            user,
          }),
        );
      },
      { token, user },
    );
    let rejectArea = true;
    const areas: Record<string, unknown>[] = [],
      devices: Record<string, unknown>[] = [],
      notes: Record<string, unknown>[] = [];
    await page.route(
      'https://vgenmqsxdqtepiugcznf.supabase.co/**',
      async (r) => {
        const path = new URL(r.request().url()).pathname;
        const method = r.request().method();
        const json = r.request().postDataJSON();
        let response: unknown = [];
        if (path === '/auth/v1/user') response = user;
        else if (path === '/rest/v1/staff_members')
          response = { role: staffRole, active: true };
        else if (path === '/rest/v1/rpc/public_snapshot')
          response = {
            mode: 'real',
            clock: new Date().toISOString(),
            start: new Date().toISOString(),
            freshMinutes: 90,
            locations: [],
            observations: [],
          };
        else if (path === '/rest/v1/observation_areas') {
          if (method === 'POST' && rejectArea) {
            rejectArea = false;
            await r.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({
                message: 'Area save failed — please retry.',
              }),
            });
            return;
          }
          if (method === 'POST')
            areas.push({
              ...json,
              id: areaId,
              published: false,
              created_by: uid,
            });
          response = areas;
        } else if (path === '/rest/v1/devices') {
          if (method === 'POST')
            devices.push({
              ...json,
              id: deviceId,
              state: 'awaiting',
              last_contact: null,
              battery: null,
            });
          response = devices;
        } else if (path === '/rest/v1/maintenance_events') {
          if (method === 'POST')
            notes.push({
              ...json,
              id: 'note-test',
              created_at: new Date().toISOString(),
            });
          response = notes;
        } else if (path !== '/rest/v1/quality_issues') {
          await r.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Unimplemented test request denied',
            }),
          });
          return;
        }
        await r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      },
    );
    await page.goto('/operator');
    await expect(
      page.getByRole('heading', { name: 'Devices & operations' }),
    ).toBeVisible();
    const areaSelect = page.getByRole('combobox', {
      name: 'Observation area',
      exact: true,
    });
    await expect(areaSelect).toBeDisabled();
    await expect(areaSelect).toContainText('Create an observation area first');
    await page
      .getByRole('link', { name: 'Create an observation area first' })
      .click();
    await expect(page.getByLabel('Area name', { exact: true })).toBeFocused();
    await page
      .getByLabel('Area name', { exact: true })
      .fill('Contract test area');
    await page.getByLabel('Region', { exact: true }).fill('Test region');
    await page.getByLabel('Area latitude', { exact: true }).fill('28');
    await page.getByLabel('Area longitude', { exact: true }).fill('77');
    await page
      .getByRole('button', { name: 'Create observation area', exact: true })
      .click();
    await expect(page.locator('.form-feedback')).toContainText(
      'Area save failed',
    );
    await expect(page.locator('.form-feedback')).toBeInViewport();
    await expect(page.getByLabel('Area name', { exact: true })).toHaveValue(
      'Contract test area',
    );
    await page
      .getByRole('button', { name: 'Create observation area', exact: true })
      .click();
    await expect(page.locator('.form-feedback')).toContainText(
      'Observation area created',
    );
    await expect(areaSelect).toBeEnabled();
    await expect(areaSelect).toContainText('Contract test area');
    await areaSelect.click();
    await expect(
      page.getByRole('option', { name: 'Contract test area · Test region' }),
    ).toBeVisible();
    await page
      .getByRole('option', { name: 'Contract test area · Test region' })
      .click();
    await page.screenshot({
      path: '/tmp/rutems-area-fixed-' + test.info().project.name + '.png',
      fullPage: true,
    });
    await page
      .getByLabel('Device name', { exact: true })
      .fill('Contract test device');
    await page.getByLabel('Exact latitude', { exact: true }).fill('28.1');
    await page.getByLabel('Exact longitude', { exact: true }).fill('77.1');
    await page
      .getByLabel('Sensor model', { exact: true })
      .fill('Contract sensor');
    await page.getByLabel('Firmware version', { exact: true }).fill('1.0');
    await page
      .getByRole('button', { name: 'Register device', exact: true })
      .click();
    await expect(page.locator('.form-feedback')).toContainText(
      'Device registered',
    );
    await page
      .getByLabel('Maintenance note', { exact: true })
      .fill('Checked enclosure seals');
    await page
      .getByRole('button', { name: 'Save maintenance note', exact: true })
      .click();
    await expect(page.locator('.form-feedback')).toContainText(
      'Maintenance note saved',
    );
    expect(notes).toHaveLength(1);
    await page.reload();
    await page
      .getByRole('button', { name: 'Select device', exact: true })
      .click();
    await expect(
      page.getByText('Checked enclosure seals', { exact: false }),
    ).toBeVisible();
    expect(devices[0].latitude).toBe(28.1);
    // After reload the user must explicitly choose from existing areas.
    await expect(areaSelect).toContainText('Select an observation area');
    await areaSelect.click();
    await page
      .getByRole('option', { name: 'Contract test area · Test region' })
      .click();
    if (staffRole === 'admin') {
      await expect(
        page.getByText('Disabled removes staff workspace permissions', {
          exact: false,
        }),
      ).toBeVisible();
      await page
        .getByLabel('Staff email', { exact: true })
        .fill('invite@example.test');
      await expect(
        page.getByRole('button', { name: 'Send staff invitation' }),
      ).toBeEnabled();
      await page
        .getByRole('combobox', { name: 'Staff workspace access' })
        .click();
      await page
        .getByRole('option', { name: 'Disabled — remove staff access' })
        .click();
      await expect(
        page.getByRole('button', { name: 'Send staff invitation' }),
      ).toBeDisabled();
      await expect(
        page.getByText('Enable staff workspace access to send an invitation.'),
      ).toBeVisible();
    }
  });
}

test('signup collects email then matching passwords and requests confirmation', async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.route('**/auth/v1/signup**', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'signup-test', email: 'signup@example.test', identities: [] }, session: null }) });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
  await page.getByLabel('Email', { exact: true }).fill('signup@example.test');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  expect(requests).toHaveLength(0);
  await page.getByLabel('Password', { exact: true }).fill('Test-password-1234');
  await page.getByLabel('Confirm password', { exact: true }).fill('Different-password-1234');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.locator('.form-feedback')).toContainText('Passwords do not match');
  expect(requests).toHaveLength(0);
  await page.getByLabel('Confirm password', { exact: true }).fill('Test-password-1234');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].email).toBe('signup@example.test');
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
});

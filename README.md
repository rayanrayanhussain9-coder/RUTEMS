# RUTEMS

RUTEMS collects and displays registered environmental device observations. The application now connects to a dedicated Supabase project; the former demo backend is no longer part of the running application. There are no seeded device records or readings in the operational database.

## Run locally

```sh
npm ci
# Copy .env.example to .env and configure the public Supabase connection if needed.
npm run dev
```

Open http://localhost:3000. Login is at `/login`, and staff operations are at `/operator`. The existing checkout is `/Users/rayan/RUTEMS`.

- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: browser-safe publishable key, never a secret/service-role key.
- `VITE_RUTEMS_TILE_URL`: optional replacement tile URL; update map attribution before changing providers.
- Hosted Edge Functions use Supabase-managed `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. No service-role secret is stored in frontend code or this repository.
- `APP_ORIGIN` for the staff-invite function defaults to `http://localhost:3000`; configure the final trusted origin before hosting the frontend.

## Supabase project

The dedicated RUTEMS project is `vgenmqsxdqtepiugcznf`, in Mumbai (`ap-south-1`). The existing unrelated project was not modified. Project creation was quoted at zero monthly cost; this is not a guarantee of unlimited free usage.

Source-controlled migrations are under `supabase/migrations`. They have been applied to the dedicated hosted project. Hosted functions are under `supabase/functions`:

- `device-ingest`: device-specific authentication, validated batches, duplicate handling, persistent rejection issues and per-device rate limiting.
- `staff-invite`: validates the user's signed token, active administrator membership and MFA before requesting an invitation.

Both functions perform custom authentication inside the function. Platform legacy JWT verification is disabled intentionally; neither endpoint accepts anonymous privileged actions.

## First administrator

The initial administrator email is the project owner's email. Its temporary password was generated randomly, saved in the ignored `.rutems-initial-login.txt` with owner-only file permissions, and was not printed in chat or committed. The account is confirmed; password login and local sign-out have been verified.

1. Open `/login` and sign in using that local file.
2. Change the temporary password.
3. Choose **Set up or verify authenticator**. Scan the QR code in your authenticator app and enter its six-digit code.
4. Open **Operator Workspace**.

Administrator database actions require an `aal2` session. The first administrator was explicitly assigned during setup; public signup never grants staff access. Staff membership is administrator-controlled, not user-editable profile metadata. Invitations can be requested from the verified administrator workspace; existing confirmed accounts can also be assigned directly. Revoking staff membership immediately removes database permissions, even if the browser has an older session token.

Invitation delivery depends on Supabase's email configuration. The built-in service is restricted and is not a production mail setup. Configure an appropriate SMTP provider and trusted redirect URLs before inviting a wider team. No test staff invitation was sent during verification.

## Operator workflows

- Create an observation area with region, public centre coordinates, uncertainty, context, source and description. Areas start private.
- Register a device with name, unique generated ID, area, deployment type, exact coordinates, sensor model, firmware/calibration versions and expected upload interval.
- Generate/rotate a unique device credential. Only its SHA-256 hash is stored. A rotation immediately replaces the previous credential; plaintext is shown only in the current provisioning view.
- Record maintenance, review rejected uploads, acknowledge/resolve issues, and inspect resolution history.
- Rename devices and update firmware/calibration metadata. Historical readings retain their recorded calibration version.
- Administrators publish/unpublish observation areas and invite or assign staff. Operators manage their own registered devices; shared assignment teams are not yet implemented.
- Export the loaded authorized device inventory as CSV. The current workspace loads at most 500 devices and 100 recent maintenance/issue records.

Detailed hardware interval behavior is documented in [INGESTION.md](docs/INGESTION.md).

## Data interpretation

The map uses generalized area coordinates. Public observations exclude exact device positions and raw device identifiers. Exact positions and original readings are restricted to authorized staff.

Current cards show the latest record with its actual averaging interval. Historical charts/comparisons currently consume **device-reported 3600-second observations only**. Shorter-interval readings are stored and can be latest readings, but are not labelled hourly or automatically averaged. The hourly CSV exports the displayed hourly-history selection.

The public snapshot currently returns published areas, their latest readings and up to 170 recent records per area, with a seven-day hourly history. This is an initial read model, not a demonstrated large-network capacity target. It must be replaced with scoped/paginated history queries and tested summaries before high-volume operation.

Freshness defaults to 90 minutes. Device reporting status uses three expected upload intervals with a minimum of three minutes. These are configurable-code product policies, not scientific confidence scores. Saved places, watches and acknowledgements currently remain browser-local, under new keys that do not import old synthetic records. Watches evaluate while the app is open; no guaranteed background notification service is configured.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npx deno check supabase/functions/device-ingest/index.ts supabase/functions/staff-invite/index.ts
```

The earlier synthetic dataset and loopback server are isolated under `tests/fixtures`; they are used only for historical validation regression tests. The former demo browser suite is archived under `tests/legacy` and is not run as verification of the Supabase backend. The operational browser suite tests real empty states, access gates, navigation, mobile layout and service failure.

See [VERIFICATION.md](docs/VERIFICATION.md) for actual hosted checks, temporary-record cleanup and remaining limits.

## Work required before a public operational launch

- Complete owner authenticator enrollment and test privileged workflows with real staff sessions.
- Configure trusted frontend/auth redirect URLs, production SMTP and final website hosting. No production website has been published.
- Confirm device models, firmware, sample/upload cadence, supported units and clock synchronization; perform physical device and disconnection/retry testing.
- Establish calibration procedures and approved correction logic, deployment history/relocation workflows, sensor placement metadata and scientific validation.
- Implement and load-test short-interval aggregation, paginated/scoped queries, exports and retention/archiving for the agreed device count. Current snapshot queries are not a large-network benchmark.
- Establish backup/recovery requirements and verify restoration. Do not assume free-plan backups satisfy operational requirements.
- Decide whether saved places/watches need account synchronization; implement server-side background evaluation and delivery services if required.
- Expand staff assignments beyond creator ownership, operational auditing UI and document storage as needed.
- Review dependency advisories and enable available password security protections. The Supabase advisor currently flags leaked-password protection as disabled. Private credential/rate-limit tables intentionally deny direct access with RLS and no client policies.

There is no official weather-warning feed, scientific deployment certification, emergency service or health-clearance feature.

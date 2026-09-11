# Supabase migration verification — 11 September 2026

## Current state

Dedicated hosted Supabase project: `vgenmqsxdqtepiugcznf` (Mumbai). Five source-controlled migrations are applied. `device-ingest` version 3 and `staff-invite` version 1 are deployed. The frontend remains a local preview; no production website was published.

The initial administrator account is confirmed. Its generated temporary password is kept only in an ignored, owner-readable local file. Browser password login and local sign-out succeeded. Administrator access without a second factor was denied. The owner still needs to enroll/verify an authenticator to perform real administrator actions.

## Checks actually run

- TypeScript check, lint and production build: passed.
- Nine data/validation regression tests: passed. Eight use isolated historical fixtures/loopback server; these are not claimed as hosted Supabase tests.
- Twelve operational browser cases passed in one full desktop/mobile run. They cover empty real-data views, sign-in gates/forms, navigation, no horizontal overflow, service failure, submitted invalid login feedback, and truthful one-minute averaging labels without invented hourly history.
- Two additional isolated browser contract tests passed, one desktop and one mobile: operator area creation, device registration, maintenance note submission and persistence after page reload. ALL Supabase traffic in these two tests was intercepted; no cloud records were written by them.
- Real owner-account browser verification: temporary password sign-in succeeded; administrator workspace required MFA; local sign-out succeeded. No password was printed in tool output, screenshots or traces.
- Hosted SQL transaction test: admin `aal1` writes denied; `aal2` area/device creation and credential provisioning passed; anonymous device reads denied; private areas absent from public snapshots; explicit publication exposed the public area. All changes rolled back.
- Hosted gateway requests using a private temporary device: accepted valid batch; duplicate not reinserted; unauthenticated request returned 401; invalid humidity rejected. Original measurement time, actual interval and generalized public projection were checked in stored rows.
- Invalid upload persisted a quality issue. Authenticated SQL acknowledgement/resolution created two maintenance-history entries in a rolled-back transaction.
- Hosted staff invitation request with a valid password-only admin session returned 403 before sending any invitation. No test invitation email was sent.
- Both deployed Edge Function sources passed Deno type checking.
- Browser explorer/login snapshots rendered meaningful content without reported uncaught page errors. The login screenshot was inspected.

## Cleanup

Temporary hosted verification devices, areas, readings, projections, issues, credentials, rate counters and their test audit entries were removed. Post-cleanup counts: 0 devices, 0 readings, 0 quality issues. The initial administrator membership remains. No demo dataset is loaded by the application; fixtures live only under `tests/fixtures`.

## Security advisor

The final Supabase advisor reported:

- Two informational notices for private credential/rate-counter tables with RLS enabled and no client policies. This is intentional default-deny behavior; access goes through narrowly scoped helpers.
- Leaked-password protection disabled. Review and enable it where available before launch: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

The former public SECURITY DEFINER snapshot warnings were resolved by using an invoker function over sanitized public-observation rows protected by RLS.

The previous dependency audit is archived in `docs/archive/previous-demo-verification.md`; it was not rerun during this migration. Do not interpret an earlier audit as current production security certification.

## Not yet verified or operational

- Owner authenticator enrollment and complete privileged browser flow with a genuine MFA session.
- Successful invitation delivery to new staff, custom SMTP, production auth redirects and final frontend hosting.
- Physical ESP32/sensor uploads, offline firmware queue durability, calibration and field validation.
- High-volume load capacity, interval aggregation, paginated large history/export operations, retention/archival policy and backup restore drills.
- Background watch execution, account-synchronized personal settings, external notifications, official warnings, document storage and shared operator assignments.

The hosted data foundation is implemented and verified as described; the project is not yet ready for an unrestricted public operational launch.

### 2026-09-11 workspace bug fixes

Confirmed the live project contains zero observation areas and zero devices (read-only SQL). Replaced the blank area selector with explicit loading, unavailable, and create-first states. New areas select automatically; existing areas can be selected after reload. Operators only see areas they are permitted to register devices in. Added database-aligned field limits, visible save feedback, publication empty state, staff-access explanations, and disabled invitations when staff access is disabled. Staff directory refreshes after permissions are saved.

TypeScript, lint, and production build passed. All 16 desktop/mobile browser cases passed, including operator/admin creation, failed-save retry, dropdown interaction, device registration, maintenance persistence, and disabled-invitation behavior. Staff and device writes in browser tests are intercepted; these checks did not create cloud records or send invitations. Actual owner MFA/session actions were not exercised in this pass. These fixes do not establish that every possible application or hardware issue is resolved.

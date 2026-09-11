# Operational data model

- `auth.users`: Supabase-managed identities and password authentication.
- `staff_members`: administrator-controlled role and enabled status. Users can read only their own membership directly.
- `observation_areas`: public area name, region, context/source, generalized position, uncertainty and publication status.
- `devices`: device identity, creator/owner, area, deployment, private coordinates, sensor/firmware/calibration metadata, state and last contact.
- `device_readings`: immutable incoming raw records, measurement and receipt times, averaging period, quality flags and original coordinates. Staff read access only; device gateway writes.
- `public_observations`: sanitized projection created by a database trigger. Public read access requires the associated area to be published. Raw device identity and exact coordinates are omitted.
- `maintenance_events`: append-only staff notes and issue transitions.
- `quality_issues`: rejected upload reason, status and review note. Staff can update status/note for authorized devices.
- `audit_events`: database-generated records of device, area, membership and credential changes; administrator read access.
- `rutems_private.device_credentials`: credential hashes, never directly accessible to browser roles.
- `rutems_private.ingestion_limits`: one rate-limit counter per device, inaccessible to browser roles.

Supabase RLS and column grants enforce permissions. Narrow private privileged helpers check active staff membership and administrator MFA. Public read functions use invoker permissions. Supabase Edge Functions keep the service-role key server-side and authenticate every action separately.

No synthetic records are seeded. Test fixtures live outside application source. Browser-local saved places/watches use new real-data keys and do not inherit demo entries.

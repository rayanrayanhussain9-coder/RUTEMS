import {
  metrics,
  type Metric,
  type Values,
  type Observation,
  type Device,
  type Location,
} from './domain';
export const MAX_BATCH = 100,
  MAX_BYTES = 65536;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const iso = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v) &&
  Number.isFinite(Date.parse(v));
function values(v: unknown): v is Values {
  return (
    record(v) &&
    Object.keys(v).length === 6 &&
    Object.entries(metrics).every(
      ([k, m]) =>
        v[k] === null ||
        (typeof v[k] === 'number' &&
          Number.isFinite(v[k]) &&
          v[k] >= m.min &&
          v[k] <= m.max),
    ) &&
    Object.values(v).some((x) => x !== null)
  );
}
export function validateObservation(
  input: unknown,
  device: Pick<Device, 'id' | 'locationId'>,
  loc: Location,
  clock: string,
  demo: boolean,
): Observation | string {
  if (!record(input)) return 'Observation must be an object';
  if (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.id))
    return 'Invalid observation id';
  if (
    !iso(input.measuredAt) ||
    Date.parse(input.measuredAt) > Date.parse(clock) ||
    Date.parse(input.measuredAt) < Date.parse(clock) - 31 * 86400000
  )
    return 'Measurement time must be UTC, not future, and within 31 days';
  if (input.averagingSeconds !== 3600)
    return 'This pilot accepts 3600-second averages only';
  if (!values(input.raw))
    return 'All six raw metric keys required; use null for missing, with at least one bounded finite value';
  if (
    input.corrected !== undefined &&
    input.corrected !== null &&
    !values(input.corrected)
  )
    return 'Invalid corrected values';
  if (input.quality !== 'valid' && input.quality !== 'suspect')
    return 'Quality must be valid or suspect; invalid data is rejected';
  if (
    !Array.isArray(input.flags) ||
    input.flags.length > 8 ||
    !input.flags.every((f) => typeof f === 'string' && /^[a-z_]{1,40}$/.test(f))
  )
    return 'Invalid quality flags';
  if (input.quality === 'valid' && input.flags.length)
    return 'Flagged observations must be suspect';
  if (
    typeof input.calibrationVersion !== 'string' ||
    !/^[a-zA-Z0-9_.-]{1,60}$/.test(input.calibrationVersion)
  )
    return 'Calibration version required';
  if (
    typeof input.lat !== 'number' ||
    typeof input.lng !== 'number' ||
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    Math.abs(input.lat) > 90 ||
    Math.abs(input.lng) > 180
  )
    return 'Invalid coordinates';
  if (
    typeof input.uncertaintyM !== 'number' ||
    !Number.isFinite(input.uncertaintyM) ||
    input.uncertaintyM < 0 ||
    input.uncertaintyM > 50000
  )
    return 'Invalid location uncertainty';
  if (
    Math.abs(input.lat - loc.lat) > 0.05 ||
    Math.abs(input.lng - loc.lng) > 0.05
  )
    return 'Coordinates outside registered public area';
  if (
    input.corrected &&
    Object.keys(metrics).some(
      (k) =>
        (input.raw as Values)[k as Metric] === null &&
        (input.corrected as Values)[k as Metric] !== null,
    )
  )
    return 'Corrections cannot invent missing raw measurements';
  return {
    id: input.id,
    deviceId: device.id,
    locationId: device.locationId,
    measuredAt: input.measuredAt,
    receivedAt: clock,
    averagingSeconds: 3600,
    raw: input.raw,
    corrected: (input.corrected as Values) ?? null,
    quality: input.quality,
    flags: input.flags as string[],
    calibrationVersion: input.calibrationVersion,
    demo,
    lat: input.lat,
    lng: input.lng,
    uncertaintyM: input.uncertaintyM,
  };
}
export const duplicateKey = (
  o: Pick<Observation, 'deviceId' | 'measuredAt' | 'averagingSeconds'>,
) => `${o.deviceId}|${o.measuredAt}|${o.averagingSeconds}`;

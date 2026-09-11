export const SCENARIO_CLOCK = '2026-09-09T06:30:00.000Z';
export const SCENARIO_START = '2026-09-02T06:30:00.000Z';
export const HOUR = 3_600_000;
export const DEFAULT_FRESH_MINUTES = 90;
export const metrics = {
  pm25: {
    name: 'PM2.5',
    unit: 'µg/m³',
    min: 0,
    max: 2000,
    description: 'Fine particulate concentration',
  },
  pm10: {
    name: 'PM10',
    unit: 'µg/m³',
    min: 0,
    max: 3000,
    description: 'Coarse and fine particulate concentration',
  },
  temperature: {
    name: 'Temperature',
    unit: '°C',
    min: -50,
    max: 70,
    description: 'Ambient air temperature',
  },
  humidity: {
    name: 'Humidity',
    unit: '%',
    min: 0,
    max: 100,
    description: 'Relative humidity',
  },
  pressure: {
    name: 'Pressure',
    unit: 'hPa',
    min: 300,
    max: 1100,
    description: 'Atmospheric pressure',
  },
  uv: {
    name: 'UV index',
    unit: '',
    min: 0,
    max: 30,
    description: 'Solar ultraviolet intensity',
  },
} as const;
export type Metric = keyof typeof metrics;
export type Values = Record<Metric, number | null>;
export type Quality = 'valid' | 'suspect' | 'invalid';
export type Location = {
  id: string;
  name: string;
  region: string;
  context: 'urban' | 'trail';
  source: 'fixed' | 'mobile';
  lat: number;
  lng: number;
  uncertaintyM: number;
  description: string;
};
export type Device = {
  id: string;
  locationId: string;
  deployment: 'fixed' | 'wearable' | 'vehicle';
  state: 'online' | 'offline' | 'maintenance';
  lastContact: string | null;
  battery: number | null;
  calibrationVersion: string;
  calibratedAt: string;
  history: { at: string; note: string }[];
};
export type Observation = {
  id: string;
  deviceId: string;
  locationId: string;
  measuredAt: string;
  receivedAt: string;
  averagingSeconds: number;
  raw: Values;
  corrected: Values | null;
  quality: Quality;
  flags: string[];
  calibrationVersion: string;
  demo: boolean;
  lat: number;
  lng: number;
  uncertaintyM: number;
};
export type Snapshot = {
  mode: 'demo' | 'real';
  clock: string;
  start: string;
  freshMinutes: number;
  locations: Location[];
  observations: Observation[];
};
export const emptyValues = (): Values => ({
  pm25: null,
  pm10: null,
  temperature: null,
  humidity: null,
  pressure: null,
  uv: null,
});
export const valueOf = (o: Observation | undefined, m: Metric) =>
  o?.quality === 'invalid' ? null : ((o?.corrected ?? o?.raw)?.[m] ?? null);
export const timeMs = (s: string) => new Date(s).getTime();
export const fmtTime = (s: string, full = true) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    ...(full ? { day: '2-digit', month: 'short' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(s)) + ' IST';
export function latest(rows: Observation[], id: string) {
  return rows
    .filter((o) => o.locationId === id)
    .sort((a, b) => timeMs(b.measuredAt) - timeMs(a.measuredAt))[0];
}
export function freshness(
  o: Observation | undefined,
  clock = SCENARIO_CLOCK,
  minutes = DEFAULT_FRESH_MINUTES,
) {
  if (!o) return 'Unavailable';
  if (o.quality === 'invalid') return 'Invalid';
  const age = timeMs(clock) - timeMs(o.measuredAt);
  return age >= 0 && age <= minutes * 60000 ? 'Recent' : 'Stale';
}
export function history(
  rows: Observation[],
  id: string,
  hours: number,
  clock = SCENARIO_CLOCK,
) {
  const end = timeMs(clock);
  return rows
    .filter(
      (o) =>
        o.locationId === id &&
        timeMs(o.measuredAt) > end - hours * HOUR &&
        timeMs(o.measuredAt) <= end &&
        o.averagingSeconds === 3600,
    )
    .sort((a, b) => timeMs(a.measuredAt) - timeMs(b.measuredAt));
}
// One record per shared hour bucket; delayed/repeated uploads never increase coverage.
export function series(
  rows: Observation[],
  id: string,
  m: Metric,
  hours: number,
  clock = SCENARIO_CLOCK,
) {
  const end = timeMs(clock);
  const selected = history(rows, id, hours, clock);
  return Array.from({ length: hours }, (_, i) => {
    const at = end - (hours - i - 1) * HOUR;
    const records = selected.filter(
      (o) => timeMs(o.measuredAt) > at - HOUR && timeMs(o.measuredAt) <= at,
    );
    const o = records.at(-1);
    return {
      at: new Date(at).toISOString(),
      value: o?.quality === 'valid' ? valueOf(o, m) : null,
      observation: o,
    };
  });
}
export function summary(
  rows: Observation[],
  id: string,
  m: Metric,
  hours: number,
  clock = SCENARIO_CLOCK,
) {
  const s = series(rows, id, m, hours, clock),
    valid = s.filter((x) => x.value !== null);
  return {
    mean: valid.length
      ? valid.reduce((n, x) => n + x.value!, 0) / valid.length
      : null,
    coverage: Math.round((valid.length / hours) * 100),
    count: valid.length,
    expected: hours,
  };
}
export type Watch = {
  id: string;
  locationId: string;
  metric: Metric;
  threshold: number;
  hours: 1 | 24;
};
export type Notice = {
  id: string;
  watchId: string;
  locationId: string;
  metric: Metric;
  threshold: number;
  hours: number;
  value: number;
  observationId: string;
  measuredAt: string;
  acknowledged: boolean;
  dismissed?: boolean;
};
export function evaluateWatch(
  w: Watch,
  data: Snapshot,
): { state: string; notice?: Notice } {
  const o = latest(data.observations, w.locationId);
  if (
    freshness(o, data.clock, data.freshMinutes) !== 'Recent' ||
    o?.quality !== 'valid' ||
    valueOf(o, w.metric) === null
  )
    return { state: 'Not evaluated · recent, valid measurement unavailable' };
  const s = summary(
    data.observations,
    w.locationId,
    w.metric,
    w.hours,
    data.clock,
  );
  if (s.coverage < 75 || s.mean === null)
    return { state: 'Not evaluated · insufficient coverage' };
  if (s.mean > w.threshold)
    return {
      state: 'Threshold exceeded',
      notice: {
        id: `${w.id}:${o.id}`,
        watchId: w.id,
        locationId: w.locationId,
        metric: w.metric,
        threshold: w.threshold,
        hours: w.hours,
        value: s.mean,
        observationId: o.id,
        measuredAt: o.measuredAt,
        acknowledged: false,
      },
    };
  return { state: 'Below your threshold · evaluated observation only' };
}
const csvCell = (v: string | number | null | undefined) =>
  '"' + String(v ?? '').replaceAll('"', '""') + '"';
export function observationsCSV(rows: Observation[], locations: Location[]) {
  const header = [
    'observation_id',
    'public_area',
    'source_type',
    'data_mode',
    'measured_at_utc',
    'received_at_utc',
    'averaging_seconds',
    'quality',
    'quality_flags',
    'calibration_version',
    'value_kind',
    ...Object.entries(metrics).map(([k, m]) => `${k} [${m.unit || 'index'}]`),
  ];
  const lines = rows.flatMap((o) => {
    const loc = locations.find((l) => l.id === o.locationId);
    return (
      ['raw', ...(o.corrected ? ['corrected'] : [])] as ('raw' | 'corrected')[]
    ).map((kind) => [
      o.id,
      loc?.name,
      loc?.source,
      o.demo ? 'fictional demo' : 'real device',
      o.measuredAt,
      o.receivedAt,
      o.averagingSeconds,
      o.quality,
      o.flags.join(';'),
      o.calibrationVersion,
      kind,
      ...Object.keys(metrics).map((k) => o[kind]?.[k as Metric]),
    ]);
  });
  return [header, ...lines]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

export function averagingLabel(seconds: number | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return 'Interval unavailable';
  if (seconds % 3600 === 0) return `${seconds / 3600}-hour average`;
  if (seconds % 60 === 0) return `${seconds / 60}-minute average`;
  return `${seconds}-second average`;
}

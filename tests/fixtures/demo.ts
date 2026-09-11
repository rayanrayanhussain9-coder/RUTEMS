import {
  type Location,
  type Device,
  type Observation,
  type Snapshot,
  emptyValues,
  SCENARIO_CLOCK,
  SCENARIO_START,
  HOUR,
  DEFAULT_FRESH_MINUTES,
} from '../../lib/rutems/domain';
export const locations: Location[] = [
  {
    id: 'lodhi-garden',
    name: 'Lodhi Garden',
    region: 'Delhi',
    context: 'urban',
    source: 'fixed',
    lat: 28.5933,
    lng: 77.2205,
    uncertaintyM: 150,
    description:
      'A fictional fixed observation area near the garden. Park surroundings can differ from nearby streets.',
  },
  {
    id: 'india-gate',
    name: 'India Gate precinct',
    region: 'Delhi',
    context: 'urban',
    source: 'fixed',
    lat: 28.6129,
    lng: 77.2295,
    uncertaintyM: 150,
    description:
      'A fictional fixed observation area in central Delhi. The latest upload is delayed.',
  },
  {
    id: 'central-delhi',
    name: 'Central Delhi route area',
    region: 'Delhi',
    context: 'urban',
    source: 'mobile',
    lat: 28.628,
    lng: 77.215,
    uncertaintyM: 700,
    description:
      'A generalized fictional vehicle observation area. Positions are area centres, not individual journeys.',
  },
  {
    id: 'yamuna-edge',
    name: 'Yamuna edge',
    region: 'Delhi',
    context: 'urban',
    source: 'fixed',
    lat: 28.621,
    lng: 77.253,
    uncertaintyM: 250,
    description:
      'A fictional fixed site demonstrating a rejected measurement. It does not describe river water quality.',
  },
  {
    id: 'landour-ridge',
    name: 'Landour ridge',
    region: 'Mussoorie',
    context: 'trail',
    source: 'fixed',
    lat: 30.4612,
    lng: 78.095,
    uncertaintyM: 200,
    description:
      'A fictional observation area near Landour, Mussoorie, Uttarakhand. Conditions vary with terrain and exposure.',
  },
  {
    id: 'camel-back',
    name: 'Camel’s Back route area',
    region: 'Mussoorie',
    context: 'trail',
    source: 'mobile',
    lat: 30.463,
    lng: 78.075,
    uncertaintyM: 500,
    description:
      'Generalized fictional wearable observations around Camel’s Back Road. No personal tracks are displayed.',
  },
  {
    id: 'cloud-end',
    name: 'Cloud’s End',
    region: 'Mussoorie',
    context: 'trail',
    source: 'fixed',
    lat: 30.464,
    lng: 78.026,
    uncertaintyM: 250,
    description:
      'A fictional forest-edge site with an offline device and a gap in recent observations.',
  },
  {
    id: 'george-everest',
    name: 'George Everest area',
    region: 'Mussoorie',
    context: 'trail',
    source: 'mobile',
    lat: 30.46,
    lng: 78.039,
    uncertaintyM: 700,
    description:
      'A fictional mobile observation area. The demonstration device is under maintenance; no measurements are available.',
  },
];
export const devices: Device[] = locations.map((l, i) => ({
  id: `demo-${l.id}`,
  locationId: l.id,
  deployment:
    l.source === 'fixed'
      ? 'fixed'
      : l.context === 'urban'
        ? 'vehicle'
        : 'wearable',
  state: i === 6 ? 'offline' : i === 7 ? 'maintenance' : 'online',
  lastContact:
    i === 7
      ? null
      : new Date(
          Date.parse(SCENARIO_CLOCK) -
            (i === 1 ? 7 : i === 6 ? 50 : 0) * HOUR -
            2 * 60000,
        ).toISOString(),
  battery: i === 2 ? null : 84 - i * 9,
  calibrationVersion: 'DEMO-CAL-01',
  calibratedAt: '2026-08-15T04:30:00.000Z',
  history: [
    {
      at: '2026-08-15T04:30:00.000Z',
      note: 'Synthetic calibration metadata recorded; no reference validation performed.',
    },
    ...(i === 7
      ? [
          {
            at: '2026-09-07T05:00:00.000Z',
            note: 'Demo maintenance: enclosure inspection. Data collection paused.',
          },
        ]
      : []),
  ],
}));
export function generateDemo(): Snapshot {
  const observations: Observation[] = [];
  locations.forEach((l, i) => {
    if (i === 7) return;
    for (let age = 167; age >= 0; age--) {
      if (
        (i === 1 && age < 7) ||
        (i === 6 && age < 50) ||
        (i === 5 && age % 5 === 0) ||
        (age >= 27 && age <= 33) ||
        (i === 2 && age >= 5 && age <= 8)
      )
        continue;
      const t = Date.parse(SCENARIO_CLOCK) - age * HOUR - 5 * 60000;
      const phase = Math.sin(age * 0.38 + i);
      const daylight = Math.max(
        0,
        Math.cos(((new Date(t).getUTCHours() - 6) * Math.PI) / 12),
      );
      const raw = {
        pm25: +(
          (i < 4 ? 42.6 + i * 8 : 12.4 + (i - 4) * 3) +
          phase * 5
        ).toFixed(1),
        pm10:
          i === 5
            ? null
            : +((i < 4 ? 78 + i * 12 : 21 + (i - 4) * 4) + phase * 9).toFixed(
                1,
              ),
        temperature: +((i < 4 ? 30.8 : 18.6) + phase * 2.2).toFixed(1),
        humidity: +(i < 4 ? 62 + phase * 7 : 73 + phase * 8).toFixed(1),
        pressure: +(i < 4 ? 1004.2 + phase * 2 : 806.3 + phase * 2).toFixed(1),
        uv: +(daylight * (i < 4 ? 5.4 : 6.3)).toFixed(1),
      };
      if (i === 4 && age === 0) raw.pm25 = 12.4;
      const invalid = i === 3 && age === 0;
      if (invalid) {
        raw.pm25 = -8;
        raw.humidity = 142;
      }
      const suspect = i === 2 && age === 0;
      observations.push({
        id: `seed-${l.id}-${age}`,
        deviceId: devices[i].id,
        locationId: l.id,
        measuredAt: new Date(t).toISOString(),
        receivedAt: new Date(t + 3 * 60000).toISOString(),
        averagingSeconds: 3600,
        raw,
        corrected: null,
        quality: invalid ? 'invalid' : suspect ? 'suspect' : 'valid',
        flags: invalid ? ['out_of_range'] : suspect ? ['placement_review'] : [],
        calibrationVersion: 'DEMO-CAL-01',
        demo: true,
        lat: l.lat,
        lng: l.lng,
        uncertaintyM: l.uncertaintyM,
      });
    }
  });
  return {
    mode: 'demo',
    clock: SCENARIO_CLOCK,
    start: SCENARIO_START,
    freshMinutes: DEFAULT_FRESH_MINUTES,
    locations,
    observations,
  };
}
export function controlledObservation(
  locationId = 'lodhi-garden',
  metric = 'pm25',
  value = 72.2,
) {
  const l = locations.find((x) => x.id === locationId)!;
  return {
    id: `controlled-${locationId}-${metric}-${value}`.replaceAll('.', '_'),
    measuredAt: SCENARIO_CLOCK,
    averagingSeconds: 3600,
    raw: {
      ...emptyValues(),
      pm25: 42.6,
      pm10: 78,
      temperature: 30.8,
      humidity: 62,
      pressure: 1004.2,
      uv: 5.4,
      [metric]: value,
    },
    quality: 'valid',
    flags: [],
    calibrationVersion: 'DEMO-CAL-01',
    lat: l.lat,
    lng: l.lng,
    uncertaintyM: l.uncertaintyM,
  };
}

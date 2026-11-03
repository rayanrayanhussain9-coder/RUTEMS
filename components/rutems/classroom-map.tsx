'use client';
import { useState } from 'react';
import ObservationMap from './map';
import { Button } from './shared';
import {
  type Snapshot,
  type Metric,
  emptyValues,
  metrics,
} from '@/lib/rutems/domain';

const clock = '2026-09-09T05:30:00Z';
const sites = [
  {
    id: 'garden',
    name: 'Lodhi Garden',
    lat: 28.5933,
    lng: 77.2205,
    pm25: 22,
    temperature: 27,
    humidity: 56,
  },
  {
    id: 'gate',
    name: 'India Gate',
    lat: 28.6129,
    lng: 77.2295,
    pm25: 38,
    temperature: 29,
    humidity: 51,
  },
  {
    id: 'river',
    name: 'Yamuna riverbank',
    lat: 28.621,
    lng: 77.253,
    pm25: 30,
    temperature: 28,
    humidity: 62,
  },
];
const data: Snapshot = {
  mode: 'demo',
  clock,
  start: '2026-09-09T04:30:00Z',
  freshMinutes: 60,
  locations: sites.map(({ id, name, lat, lng }) => ({
    id,
    name,
    lat,
    lng,
    region: 'Delhi',
    context: 'urban',
    source: 'fixed',
    uncertaintyM: 150,
    description: 'Fictional classroom station.',
  })),
  observations: sites.map(({ id, lat, lng, pm25, temperature, humidity }) => ({
    id: 'sample-' + id,
    deviceId: 'class-' + id,
    locationId: id,
    lat,
    lng,
    uncertaintyM: 150,
    measuredAt: clock,
    receivedAt: clock,
    averagingSeconds: 3600,
    raw: { ...emptyValues(), pm25, temperature, humidity },
    corrected: null,
    quality: 'valid',
    flags: [],
    calibrationVersion: 'classroom',
    demo: true,
  })),
};
export function ClassroomMap({ onExit }: { onExit: () => void }) {
  const [id, select] = useState('garden'),
    [metric, setMetric] = useState<Metric>('pm25');
  const obs = data.observations.find((o) => o.locationId === id)!;
  return (
    <div className="app-wrap">
      <p className="eyebrow">EXPLORE · CLASSROOM DEMONSTRATION</p>
      <h1>Three stations in Delhi</h1>
      <p>
        <strong>Fictional readings, not live device data.</strong> Each marker
        shows a one-hour average ending at 11:00 IST on 9 September 2026.
      </p>
      <Button onClick={onExit}>Return to live map</Button>
      <div className="explore-toolbar">
        <label>
          Map measurement{' '}
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            {(['pm25', 'temperature', 'humidity'] as const).map((m) => (
              <option key={m} value={m}>
                {metrics[m].name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ObservationMap
        locations={data.locations}
        data={data}
        metric={metric}
        selected={id}
        onSelect={select}
        region="Delhi"
      />
      <div className="explore-toolbar">
        {sites.map((s) => (
          <button
            className="btn"
            key={s.id}
            aria-pressed={s.id === id}
            onClick={() => select(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <p aria-live="polite">
        <strong>{sites.find((s) => s.id === id)?.name}</strong> ·{' '}
        {metrics[metric].name}: {obs.raw[metric]} {metrics[metric].unit}
      </p>
      <p>
        Classroom question: Which station had the highest sample PM2.5? What
        else would you need to measure to explain the difference?
      </p>
    </div>
  );
}

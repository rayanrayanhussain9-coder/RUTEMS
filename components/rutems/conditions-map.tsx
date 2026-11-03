'use client';
import { useMemo, useState } from 'react';
import ObservationMap from './map';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button, Choice, Segments } from './shared';
import {
  type Snapshot,
  type Metric,
  emptyValues,
  metrics,
} from '@/lib/rutems/domain';

const clock = '2026-09-09T05:30:00Z';
const originals = [
  {
    id: 'garden',
    name: 'Lodhi Garden',
    lat: 28.5933,
    lng: 77.2205,
    pm25: 22,
    pm10: 48,
    pressure: 1008,
    uv: 2,
    aqi: 46,
    temperature: 27,
    humidity: 56,
  },
  {
    id: 'gate',
    name: 'India Gate',
    lat: 28.6129,
    lng: 77.2295,
    pm25: 134,
    pm10: 221,
    pressure: 1005,
    uv: 9,
    aqi: 316,
    temperature: 29,
    humidity: 51,
  },
  {
    id: 'river',
    name: 'Yamuna riverbank',
    lat: 28.621,
    lng: 77.253,
    pm25: 76,
    pm10: 125,
    pressure: 1006,
    uv: 6,
    aqi: 171,
    temperature: 28,
    humidity: 62,
  },
];
// Illustrative station positions near regional anchors, not installed devices.
const anchors = [
 ['Delhi',28.61,77.21,'urban'],['Chandigarh',30.74,76.79,'urban'],
 ['Mussoorie',30.46,78.08,'trail'],['Manali',32.24,77.18,'trail'],
 ['Ahmedabad',23.03,72.58,'urban'],['Amritsar',31.63,74.87,'urban'],
 ['Ajmer',26.45,74.64,'urban'],['Mumbai',19.08,72.88,'urban'],
 ['Bengaluru',12.97,77.59,'urban'],['Chennai',13.08,80.27,'urban'],
 ['Hyderabad',17.39,78.49,'urban'],['Bhubaneswar',20.30,85.82,'urban'],
 ['Kolkata',22.57,88.36,'urban'],['Patna',25.59,85.14,'urban'],
 ['Bhopal',23.26,77.41,'urban'],['Guwahati',26.14,91.74,'urban'],
 ['Aizawl',23.73,92.72,'trail'],['Shillong',25.58,91.89,'trail'],
 ['Gangtok',27.33,88.61,'trail'],['Leh',34.15,77.58,'trail'],
 ['Srinagar',34.08,74.80,'trail'],['Munnar',10.09,77.06,'trail'],
 ['Ooty',11.41,76.70,'trail'],['Mahabaleshwar',17.93,73.66,'trail'],
 ['Ranchi',23.34,85.31,'trail'],
] as const;
const groups=anchors.map(([region,lat,lng,context])=>({region,lat,lng,context}));
const sites = groups.flatMap((g, k) =>
  Array.from({ length: 4 }, (_, j) => {
    const n = k * 4 + j;
    const raw =
      k === 0 && j < 3
        ? originals[j]
        : {
            id: 'atlas-' + n,
            name: g.region + ' ' + (g.context==='urban'?['Garden','Market','Square','Avenue']:['Ridge','Lookout','Bend','Pass'])[j],
            lat: g.lat + (j < 2 ? -1 : 1) * 0.024,
            lng: g.lng + (j % 2 ? -1 : 1) * 0.025,
            pm25: 9 + ((n * 17) % 138),
            pm10: 32 + ((n * 17) % 138) + (n % 35),
            uv: (n * 5) % 13,
            pressure: (k < 2 ? 1000 : 795) + (n % 23),
            temperature: (k < 2 ? 23 : 10) + (n % 15),
            humidity: 40 + (n % 45),
            aqi: 18 + ((n * 31) % 445),
          };
    return {
      ...raw,
      region: g.region,
      context: g.context,
      source: n % 4 === 3 ? ('mobile' as const) : ('fixed' as const),
      stale: n % 9 === 8,
      suspect: n % 11 === 10,
    };
  }),
);
const data: Snapshot = {
  mode: 'demo',
  clock,
  start: '2026-09-09T04:30:00Z',
  freshMinutes: 60,
  locations: sites.map(({ id, name, lat, lng, region, context, source }) => ({
    id,
    name,
    lat,
    lng,
    region,
    context,
    source,
    uncertaintyM: 150,
    description: 'Sample station.',
  })),
  observations: sites.map(
    ({
      id,
      lat,
      lng,
      pm25,
      temperature,
      humidity,
      pm10,
      pressure,
      uv,
      stale,
      suspect,
    }) => ({
      id: 'sample-' + id,
      deviceId: 'class-' + id,
      locationId: id,
      lat,
      lng,
      uncertaintyM: 150,
      measuredAt: stale ? '2026-09-09T02:30:00Z' : clock,
      receivedAt: clock,
      averagingSeconds: 3600,
      raw: {
        ...emptyValues(),
        pm25,
        pm10,
        pressure,
        uv,
        temperature,
        humidity,
      },
      corrected: null,
      quality: suspect ? 'suspect' : 'valid',
      flags: [],
      calibrationVersion: 'classroom',
      demo: true,
    }),
  ),
};
type Layer = Metric | 'aqi';
const layers = [
  'aqi',
  'uv',
  'pm25',
  'pm10',
  'temperature',
  'humidity',
  'pressure',
] as const;
const name = (m: Layer) =>
  m === 'aqi' ? 'Air Quality Index' : metrics[m].name;
const unit = (m: Layer) => (m === 'aqi' ? '' : metrics[m].unit);
const palette = [
  '#245d91',
  '#146956',
  '#906000',
  '#ad4711',
  '#ac273d',
  '#6a263e',
];
function scale(m: Layer) {
  if (m === 'aqi')
    return {
      limits: [50, 100, 200, 300, 400],
      labels: [
        'Good',
        'Satisfactory',
        'Moderate',
        'Poor',
        'Very poor',
        'Severe',
      ],
      colors: [
        '#267339',
        '#598121',
        '#896500',
        '#b45010',
        '#ae2635',
        '#6a2032',
      ],
    };
  if (m === 'uv')
    return {
      limits: [2, 5, 7, 10],
      labels: ['Low', 'Moderate', 'High', 'Very high', 'Extreme'],
      colors: ['#267339', '#896500', '#b45010', '#ae2635', '#682c89'],
    };
  const values = sites.map((s) => s[m]).sort((a, b) => a - b);
  return {
    limits: [values[32], values[65]],
    labels: [
      'Lower in sample set',
      'Middle in sample set',
      'Higher in sample set',
    ],
    colors: [palette[0], palette[1], palette[3]],
  };
}
export function ConditionsMap({ onExit }: { onExit: () => void }) {
  const [layer, setLayer] = useState<Layer>('aqi'),
    [id, select] = useState('gate');
  const [q, search] = useState(''),
    [context, contextTo] = useState('all'),
    [region, regionTo] = useState('all'),
    [source, sourceTo] = useState('all'),
    [fresh, freshTo] = useState('all'),
    [quality, qualityTo] = useState('all');
  const reset = () => {
    search('');
    contextTo('all');
    regionTo('all');
    sourceTo('all');
    freshTo('all');
    qualityTo('all');
  };
  const filtered = useMemo(
    () =>
      sites.filter(
        (s) =>
          s.name
            .toLowerCase()
            .startsWith(q.trim().toLowerCase()) &&
          (context === 'all' || context === s.context) &&
          (region === 'all' || region === s.region) &&
          (source === 'all' || source === s.source) &&
          (fresh === 'all' || fresh === (s.stale ? 'stale' : 'recent')) &&
          (quality === 'all' || quality === (s.suspect ? 'suspect' : 'valid')),
      ),
    [q, context, region, source, fresh, quality],
  );
  const locations = useMemo(() => {
    const ids = new Set(filtered.map((s) => s.id));
    return data.locations.filter((l) => ids.has(l.id));
  }, [filtered]);
  const site = filtered.find((s) => s.id === id) ?? filtered[0];
  const overlay = useMemo(() => {
    const sc = scale(layer);
    return {
      name: name(layer),
      unit: unit(layer),
      points: Object.fromEntries(
        sites.map((s) => {
          const value = s[layer];
          let i = sc.limits.findIndex((limit) => value <= limit);
          if (i < 0) i = sc.labels.length - 1;
          return [s.id, { value, label: sc.labels[i], color: sc.colors[i] }];
        }),
      ),
    };
  }, [layer]);
  const sc = scale(layer);
  return (
    <section className="app-wrap conditions">
      <div className="conditions-heading">
        <div>
          <p className="eyebrow">THE OBSERVATION EXPLORER</p>
          <h1>Environmental atlas</h1>
          <p>
            Explore city streets and mountain trails. Search for a station or
            choose what the map shows.
          </p>
        </div>
        <Button onClick={onExit}>Live device map →</Button>
      </div>
      <p className="sample-note">
        <strong>Sample data</strong> · 9 Sep 2026, 11:00 IST · Illustrative
        station values
      </p>
      <div className="explore-toolbar">
        <div className="search-box">
          <Search size={18} />
          <Input
            type="search"
            aria-label="Search locations"
            placeholder="Type the start of a place name"
            value={q}
            onChange={(e) => search(e.target.value)}
          />
        </div>
        <Segments
          label="Environment"
          value={context}
          onChange={contextTo}
          options={[
            { value: 'all', label: 'All places' },
            { value: 'urban', label: 'Urban' },
            { value: 'trail', label: 'Trails' },
          ]}
        />
      </div>
      {q.trim() && filtered.length>0 && <div className="layer-picker" aria-label="Matching places">{filtered.slice(0,8).map(s=><button key={s.id} onClick={()=>{search(s.name);select(s.id)}}>{s.name}</button>)}</div>}
      <div className="filters">
        {[
          {
            label: 'Region',
            value: region,
            set: regionTo,
            opts: groups.map((g) => g.region),
          },
          {
            label: 'Source',
            value: source,
            set: sourceTo,
            opts: ['fixed', 'mobile'],
          },
          {
            label: 'Freshness',
            value: fresh,
            set: freshTo,
            opts: ['recent', 'stale'],
          },
          {
            label: 'Quality',
            value: quality,
            set: qualityTo,
            opts: ['valid', 'suspect'],
          },
        ].map((f) => (
          <Choice
            key={f.label}
            label={f.label}
            value={f.value}
            onChange={f.set}
            options={[
              { value: 'all', label: 'All' },
              ...f.opts.map((v) => ({
                value: v,
                label: v[0].toUpperCase() + v.slice(1),
              })),
            ]}
          />
        ))}
        <Button onClick={reset}>Reset filters</Button>
      </div>
      <p role="status">
        {filtered.length} of {sites.length} sample locations
      </p>
      <div className="layer-picker" aria-label="Map layers">
        {layers.map((m) => (
          <button
            key={m}
            aria-pressed={m === layer}
            onClick={() => setLayer(m)}
          >
            {name(m)}
          </button>
        ))}
      </div>
      {site ? (
        <div className="conditions-grid">
          <div>
            <ObservationMap
              data={data}
              locations={locations}
              metric={layer === 'aqi' ? 'pm25' : layer}
              selected={site.id}
              onSelect={select}
              region={region === 'all' ? 'Sample locations' : region}
              overlay={overlay}
            />
            <div className="band-key">
              {sc.labels.map((label, i) => (
                <span key={label}>
                  <i style={{ background: sc.colors[i] }} />
                  {label}
                  {layer === 'aqi' || layer === 'uv'
                    ? ' · ' +
                      (i === 0 ? '0' : sc.limits[i - 1] + 1) +
                      (i < sc.limits.length
                        ? '–' + sc.limits[i]
                        : layer === 'aqi'
                          ? '–500'
                          : '+')
                    : ''}
                </span>
              ))}
            </div>
          </div>
          <aside className="station-card">
            <p className="eyebrow">STATION DETAILS</p>
            <label>
              Station{' '}
              <select value={site.id} onChange={(e) => select(e.target.value)}>
                {filtered.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <h2>{site.name}</h2>
            <p>
              {site.region} · {site.context} · {site.source} ·{' '}
              {site.stale ? 'Stale' : 'Recent'} at scenario time ·{' '}
              {site.suspect ? 'Review needed' : 'Valid'}
            </p>
            <p aria-live="polite">
              <strong style={{ color: overlay.points[site.id].color }}>
                {site[layer]} {unit(layer)} · {overlay.points[site.id].label}
              </strong>
            </p>
            <dl>
              {layers.map((m) => (
                <div key={m}>
                  <dt>{name(m)}</dt>
                  <dd>
                    {site[m]} {unit(m)}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      ) : (
        <div className="station-card">
          <h2>No matching locations</h2>
          <p>Try a shorter name or reset your filters to see all stations.</p>
        </div>
      )}
      <p className="micro">
        {layer === 'aqi' ? (
          <>
            Illustrative scores use{' '}
            <a href="https://ies.gov.in/arthapedia/concept/national-air-quality-index">
              Indian AQI categories
            </a>
            . They are not calculated from the displayed particulate readings.
          </>
        ) : layer === 'uv' ? (
          <>
            Colors follow the{' '}
            <a href="https://www.epa.gov/sunsafety/uv-index-scale-0">
              UV Index scale
            </a>
            .
          </>
        ) : (
          'Colors compare the 100 sample stations; they are not safety ratings.'
        )}{' '}
        Dots mark station locations, not the extent of affected areas.
      </p>
    </section>
  );
}

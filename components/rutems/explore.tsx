'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  GitCompareArrows,
  Download,
  Clock,
  Radio,
  Thermometer,
  Wind,
  Droplets,
  Gauge,
  Sun,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  averagingLabel,
  type Metric,
  metrics,
  latest,
  valueOf,
  freshness,
  fmtTime,
  history,
  observationsCSV,
  summary,
} from '@/lib/rutems/domain';
import { download } from '@/lib/rutems/data-access';
import {
  useApp,
  Choice,
  MetricChoice,
  Button,
  DataBanner,
  DataGuard,
  SavedLink,
  Note,
  Segments,
  EmptyState,
} from './shared';
import ObservationMap from './map';
import { HistoryChart } from './history';
const icons = {
  pm25: Wind,
  pm10: Wind,
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  uv: Sun,
};
export function Status({ state }: { state: string }) {
  return (
    <span className={'status ' + state.toLowerCase()}>
      <span className="status-dot" />
      {state}
    </span>
  );
}
export function LocationDetails({
  id,
  compact = false,
  onClose,
}: {
  id: string;
  compact?: boolean;
  onClose?: () => void;
}) {
  const { data, saved, toggleSave, comparison, setComparison, announce } =
    useApp();
  const [metric, setMetric] = useState<Metric>('pm25'),
    [hours, setHours] = useState(24);
  if (!data) return null;
  const l = data.locations.find((x) => x.id === id);
  if (!l)
    return (
      <EmptyState title="Location unavailable">
        This public area is not in the selected data mode.
      </EmptyState>
    );
  const o = latest(data.observations, id),
    state = freshness(o, data.clock, data.freshMinutes),
    s = summary(data.observations, id, metric, hours, data.clock);
  const addCompare = () => {
    if (!comparison.includes(id)) {
      setComparison([...comparison, id]);
      announce(`${l.name} added to comparison`);
    }
  };
  return (
    <div className={'location-details ' + (compact ? 'compact' : '')}>
      <div className="detail-context">
        <MapPin size={14} />
        {l.region} <span> / </span>
        {l.context === 'urban' ? 'Urban observation' : 'Trail observation'}
      </div>
      <div className="section-line">
        {compact ? (
          <h2>{l.name}</h2>
        ) : (
          <h1 className="location-title">{l.name}</h1>
        )}
        {onClose && (
          <Button
            variant="ghost"
            aria-label="Close location details"
            onClick={onClose}
          >
            ×
          </Button>
        )}
      </div>
      <div className="location-meta">
        <Status state={state} />
        <span>
          <Radio size={13} />
          {l.source === 'fixed' ? 'Fixed device' : 'Mobile observation area'}
        </span>
      </div>
      <p className="detail-description">
        {data.mode === 'demo'
          ? l.description
          : `Registered public observation area in ${l.region}. Positions are generalized; coverage is limited.`}
      </p>
      <div className="actions detail-actions">
        <Button
          variant="outline"
          onClick={() => {
            toggleSave(id);
            announce(saved.includes(id) ? 'Place removed' : 'Place saved');
          }}
        >
          {saved.includes(id) ? <BookmarkCheck /> : <Bookmark />}
          {saved.includes(id) ? 'Saved' : 'Save place'}
        </Button>
        <Button
          variant="outline"
          onClick={addCompare}
          disabled={comparison.includes(id) || comparison.length >= 3}
        >
          <GitCompareArrows />
          {comparison.includes(id)
            ? 'In comparison'
            : comparison.length >= 3
              ? 'Comparison full'
              : 'Compare'}
        </Button>
        {comparison.includes(id) && (
          <Link className="text-link" href="/compare">
            View comparison <ArrowRight size={14} />
          </Link>
        )}
      </div>
      <div className="section-line current-heading">
        <h3>Latest observation</h3>
        <span className="micro">
          {data.mode === 'demo' ? 'Synthetic data' : ''}
        </span>
      </div>
      <p className="micro">
        {o
          ? `${fmtTime(o.measuredAt)} · ${averagingLabel(o.averagingSeconds)}`
          : 'No observations received'}
        {state === 'Stale'
          ? ' · Historical reading, not current conditions'
          : ''}
      </p>
      <div className="metric-grid">
        {(Object.entries(metrics) as [Metric, (typeof metrics)[Metric]][]).map(
          ([key, m]) => {
            const Icon = icons[key],
              v = valueOf(o, key);
            return (
              <div className="metric-card" key={key}>
                <div>
                  <Icon size={15} />
                  <span>{m.name}</span>
                </div>
                <strong>
                  {v === null ? '—' : v.toFixed(1)}
                  <small>{m.unit}</small>
                </strong>
                <span className="metric-caption">
                  {state === 'Invalid'
                    ? 'Invalid · excluded'
                    : v === null
                      ? 'Measurement unavailable'
                      : state === 'Stale'
                        ? 'Stale observation'
                        : o?.quality === 'suspect'
                          ? 'Review needed'
                          : averagingLabel(o?.averagingSeconds)}
                </span>
              </div>
            );
          },
        )}
      </div>
      <div className="quality-line">
        <span>Measurement quality</span>
        <strong>
          {o?.quality === 'valid'
            ? 'Basic checks passed'
            : o?.quality === 'suspect'
              ? 'Suspect · review needed'
              : o?.quality === 'invalid'
                ? 'Invalid · rejected'
                : 'Unavailable'}
        </strong>
      </div>
      <p className="micro">
        {o?.flags.length
          ? `Flags: ${o.flags.join(', ').replaceAll('_', ' ')}. `
          : ''}
        Basic checks do not establish scientific validation.{' '}
        <Link href="/methods#quality">Understand data labels ↗</Link>
      </p>
      {compact ? (
        <>
          <div className="section-line mini-history">
            <h3>Past 24 hours</h3>
            <span className="micro">PM2.5</span>
          </div>
          <HistoryChart data={data} ids={[id]} metric="pm25" hours={24} />
          <Link className="button full-width" href={'/locations/' + id}>
            History, data & downloads <ArrowUpRight size={16} />
          </Link>
        </>
      ) : (
        <section className="history-panel">
          <div className="section-line">
            <div>
              <p className="eyebrow">HISTORICAL OBSERVATIONS</p>
              <h2>Patterns over time</h2>
            </div>
            <Segments
              label="History window"
              value={String(hours)}
              onChange={(v) => setHours(Number(v))}
              options={[
                { value: '24', label: '24 hours' },
                { value: '168', label: '7 days' },
              ]}
            />
          </div>
          <div className="history-controls">
            <MetricChoice value={metric} onChange={setMetric} />
            <div>
              <strong>{s.coverage}%</strong> valid measurement coverage
              <br />
              <span className="micro">
                {s.count} of {s.expected} shared hourly intervals
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                download(
                  `rutems-${id}-${hours}h-${data.mode}.csv`,
                  observationsCSV(
                    history(data.observations, id, hours, data.clock),
                    data.locations,
                  ),
                )
              }
            >
              <Download /> Download hourly CSV
            </Button>
          </div>
          <HistoryChart data={data} ids={[id]} metric={metric} hours={hours} />
          <Note>
            The chart and coverage use valid hourly averages only. The CSV
            retains raw and corrected readings, quality flags and missing
            values. No individual routes or exact device positions are exported.
          </Note>
        </section>
      )}
      {!compact && (
        <div className="detail-provenance">
          <h3>Observation context</h3>
          <dl>
            <div>
              <dt>Received</dt>
              <dd>{o ? fmtTime(o.receivedAt) : 'Unavailable'}</dd>
            </div>
            <div>
              <dt>Calibration</dt>
              <dd>
                {o?.calibrationVersion ?? 'Unavailable'} · metadata alone does
                not establish validation
              </dd>
            </div>
            <div>
              <dt>Value basis</dt>
              <dd>
                {o?.corrected
                  ? 'Corrected values shown; raw retained'
                  : 'Raw sensor values'}
              </dd>
            </div>
            <div>
              <dt>Public position uncertainty</dt>
              <dd>At least {l.uncertaintyM} m · area centre</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
export function Explore() {
  const { data } = useApp();
  const [query, setQuery] = useState(''),
    [region, setRegion] = useState('all'),
    [context, setContext] = useState('all'),
    [metric, setMetric] = useState<Metric>('pm25'),
    [source, setSource] = useState('all'),
    [fresh, setFresh] = useState('all'),
    [quality, setQuality] = useState('all'),
    [selected, setSelected] = useState<string | null>(null),
    [mobileView, setMobileView] = useState('map'),
    [sheet, setSheet] = useState(false),
    [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 900px)');
    const change = () => setIsMobile(m.matches);
    change();
    m.addEventListener('change', change);
    return () => m.removeEventListener('change', change);
  }, []);
  const filtered = useMemo(
    () =>
      data?.locations.filter((l) => {
        const o = latest(data.observations, l.id);
        return (
          (query
            ? `${l.name} ${l.region}`
                .toLowerCase()
                .includes(query.toLowerCase())
            : region === 'all' || l.region === region) &&
          (context === 'all' || l.context === context) &&
          (source === 'all' || source === l.source) &&
          (fresh === 'all' ||
            freshness(o, data.clock, data.freshMinutes) === fresh) &&
          (quality === 'all' || (o?.quality ?? 'unavailable') === quality)
        );
      }) ?? [],
    [data, query, region, context, source, fresh, quality],
  );
  const effectiveRegion =
    query && filtered.length ? filtered[0].region : region;
  const visibleSelected = filtered.some((l) => l.id === selected)
    ? selected
    : null;
  const reset = () => {
    setQuery('');
    setContext('all');
    setSource('all');
    setFresh('all');
    setQuality('all');
    setMetric('pm25');
  };
  const select = (id: string) => {
    setSelected(id);
    if (isMobile) setSheet(true);
  };
  return (
    <>
      <div className="app-heading wrap">
        <div>
          <p className="eyebrow">THE OBSERVATION EXPLORER</p>
          <h1>A closer look at your surroundings.</h1>
          <p className="muted">
            Explore what was measured. Keep the gaps in view.
          </p>
        </div>
        <SavedLink />
      </div>
      <div className="app-wrap">
        <DataBanner />
        <div className="explore-toolbar">
          <div className="search-box">
            <Search size={18} />
            <Input
              aria-label="Search observation areas"
              placeholder="Search registered locations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Segments
            label="Region"
            value={region}
            onChange={(v) => {
              setRegion(v);
              setQuery('');
              setContext('all');
              setSelected(null);
            }}
            options={[
              { value: 'all', label: 'All regions' },
              ...[...new Set(data?.locations.map((l) => l.region) ?? [])].map(
                (r) => ({ value: r, label: r }),
              ),
            ]}
          />
          <MetricChoice value={metric} onChange={setMetric} />
        </div>
        <div className="filters">
          <Choice
            label="Context"
            value={context}
            onChange={(v) => {
              setContext(v);
            }}
            options={[
              { value: 'all', label: 'All contexts' },
              { value: 'urban', label: 'Urban' },
              { value: 'trail', label: 'Trail' },
            ]}
          />
          <Choice
            label="Source"
            value={source}
            onChange={setSource}
            options={[
              { value: 'all', label: 'All sources' },
              { value: 'fixed', label: 'Fixed devices' },
              { value: 'mobile', label: 'Mobile areas' },
            ]}
          />
          <Choice
            label="Freshness"
            value={fresh}
            onChange={setFresh}
            options={['all', 'Recent', 'Stale', 'Unavailable', 'Invalid'].map(
              (v) => ({ value: v, label: v === 'all' ? 'All ages' : v }),
            )}
          />
          <Choice
            label="Quality"
            value={quality}
            onChange={setQuality}
            options={[
              { value: 'all', label: 'All quality states' },
              { value: 'valid', label: 'Basic checks passed' },
              { value: 'suspect', label: 'Review needed' },
              { value: 'invalid', label: 'Invalid' },
              { value: 'unavailable', label: 'Unavailable' },
            ]}
          />
          <Button variant="ghost" onClick={reset}>
            <RotateCcw /> Reset filters
          </Button>
          <span className="micro supported">
            Search covers {data?.locations.length ?? 0} supported public areas
            only.
          </span>
        </div>
        <DataGuard>
          {data && (
            <>
              <div className="mobile-view">
                <Segments
                  label="Explore view"
                  value={mobileView}
                  onChange={setMobileView}
                  options={[
                    { value: 'map', label: 'Map' },
                    { value: 'list', label: 'List' },
                  ]}
                />
                <span>{filtered.length} locations</span>
              </div>
              <div
                className={
                  'explore-layout view-' +
                  mobileView +
                  (visibleSelected ? ' has-detail' : '')
                }
              >
                <aside
                  className="observation-list"
                  aria-label="Observation locations"
                >
                  <div className="list-heading">
                    <h2>
                      Observations <span>{filtered.length}</span>
                    </h2>
                    <p>
                      {metrics[metric].name} · {metrics[metric].unit || 'index'}{' '}
                      · latest reported observation
                    </p>
                  </div>
                  {filtered.length ? (
                    filtered.map((l) => {
                      const o = latest(data.observations, l.id),
                        state = freshness(o, data.clock, data.freshMinutes),
                        v = valueOf(o, metric);
                      return (
                        <button
                          key={l.id}
                          className={
                            'location-row' +
                            (visibleSelected === l.id ? ' selected' : '')
                          }
                          aria-label={`Select ${l.name}`}
                          aria-pressed={visibleSelected === l.id}
                          onClick={() => select(l.id)}
                        >
                          <div className="section-line">
                            <span className="location-source">
                              {l.source === 'fixed'
                                ? '● FIXED'
                                : '◇ MOBILE AREA'}
                            </span>
                            <Status state={state} />
                          </div>
                          <h3>{l.name}</h3>
                          <div className="section-line">
                            <span className="micro">
                              {l.region}
                              {o?.quality === 'suspect'
                                ? ' · Review needed'
                                : ''}
                            </span>
                            <span className="row-value">
                              {v === null ? '—' : v.toFixed(1)}
                              <ChevronRight size={15} />
                            </span>
                          </div>
                          <p className="micro">
                            {o
                              ? fmtTime(o.measuredAt)
                              : 'No observation available'}
                          </p>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyState title="No matching observations">
                      Try another supported place or reset your filters.
                    </EmptyState>
                  )}
                  <div className="list-footer">
                    <InfoLine />{' '}
                    <p>
                      Recent means received measurements are no more than{' '}
                      {data.freshMinutes} minutes old by measurement time.
                    </p>
                  </div>
                </aside>
                <ObservationMap
                  locations={filtered}
                  data={data}
                  metric={metric}
                  selected={visibleSelected ?? undefined}
                  onSelect={select}
                  region={effectiveRegion}
                />
                {visibleSelected && !isMobile && (
                  <aside
                    className="desktop-detail"
                    aria-label="Selected location"
                  >
                    <LocationDetails
                      key={visibleSelected}
                      id={visibleSelected}
                      compact
                      onClose={() => setSelected(null)}
                    />
                  </aside>
                )}
              </div>
              <div className="explorer-bottom">
                <span>
                  <Clock size={14} />{' '}
                  {data.mode === 'demo'
                    ? 'Fixed scenario: 02–09 Sep 2026'
                    : 'Connected-device observations'}{' '}
                  · Times in IST
                </span>
                <Link href="/methods">
                  How to read these observations <ArrowUpRight size={14} />
                </Link>
              </div>
            </>
          )}
        </DataGuard>
      </div>
      <Sheet
        open={isMobile && sheet && !!visibleSelected}
        onOpenChange={setSheet}
      >
        <SheetContent side="bottom" className="mobile-details-sheet">
          <SheetTitle className="sr-only">Selected location details</SheetTitle>
          <SheetDescription className="sr-only">
            Environmental observations for the selected public area.
          </SheetDescription>
          {visibleSelected && (
            <LocationDetails
              key={visibleSelected}
              id={visibleSelected}
              compact
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
function InfoLine() {
  return <strong>Coverage is limited.</strong>;
}
export function LocationPage({ id }: { id: string }) {
  return (
    <div className="wrap page location-page">
      <Link className="text-link" href="/explore">
        ← Back to Explore
      </Link>
      <DataBanner />
      <DataGuard>
        <LocationDetails key={id} id={id} />
      </DataGuard>
    </div>
  );
}
export function Compare() {
  const { data, comparison, setComparison } = useApp();
  const [metric, setMetric] = useState<Metric>('pm25'),
    [hours, setHours] = useState(24);
  const ids = comparison.filter((id) =>
    data?.locations.some((l) => l.id === id),
  );
  return (
    <div className="wrap page">
      <div className="page-heading">
        <p className="eyebrow">SIDE BY SIDE</p>
        <h1>Compare places, with context.</h1>
        <p className="muted">
          The same metric. The same window. The limitations alongside.
        </p>
      </div>
      <DataBanner />
      <DataGuard>
        {data && (
          <>
            <div className="comparison-toolbar">
              <Choice
                label="Add a location"
                disabled={ids.length >= 3}
                value=""
                onChange={(id) => {
                  if (id && ids.length < 3 && !ids.includes(id))
                    setComparison([...ids, id]);
                }}
                options={[
                  {
                    value: '',
                    label:
                      ids.length >= 3
                        ? 'Three places selected'
                        : 'Choose a supported place',
                  },
                  ...data.locations
                    .filter((l) => !ids.includes(l.id))
                    .map((l) => ({ value: l.id, label: l.name })),
                ]}
              />
              <MetricChoice value={metric} onChange={setMetric} />
              <Segments
                label="Comparison window"
                value={String(hours)}
                onChange={(v) => setHours(Number(v))}
                options={[
                  { value: '24', label: '24 hours' },
                  { value: '168', label: '7 days' },
                ]}
              />
              <Button
                variant="ghost"
                onClick={() => setComparison([])}
                disabled={!ids.length}
              >
                Clear comparison
              </Button>
            </div>
            {ids.length ? (
              <>
                <div className="comparison-grid">
                  {ids.map((id) => {
                    const l = data.locations.find((l) => l.id === id)!,
                      s = summary(
                        data.observations,
                        id,
                        metric,
                        hours,
                        data.clock,
                      ),
                      o = latest(data.observations, id),
                      state = freshness(o, data.clock, data.freshMinutes);
                    return (
                      <article key={id} className="comparison-card">
                        <div className="section-line">
                          <span className="eyebrow">
                            {l.region} · {l.source}
                          </span>
                          <Button
                            variant="ghost"
                            aria-label={`Remove ${l.name}`}
                            onClick={() =>
                              setComparison(ids.filter((x) => x !== id))
                            }
                          >
                            ×
                          </Button>
                        </div>
                        <h2>
                          <Link href={'/locations/' + id}>{l.name}</Link>
                        </h2>
                        <Status state={state} />
                        <div className="comparison-value">
                          {s.mean === null ? '—' : s.mean.toFixed(1)}
                          <span>{metrics[metric].unit}</span>
                        </div>
                        <p>
                          {hours === 24 ? '24-hour' : '7-day'} historical mean
                          of available hourly averages
                        </p>
                        <div className="coverage-bar">
                          <i style={{ width: s.coverage + '%' }} />
                        </div>
                        <div className="section-line">
                          <strong>{s.coverage}% coverage</strong>
                          <span>
                            {s.count}/{s.expected} hours
                          </span>
                        </div>
                        <p className="micro">
                          Latest: {o ? fmtTime(o.measuredAt) : 'Unavailable'}
                        </p>
                        {s.coverage < 75 && (
                          <p className="comparison-warning">
                            Insufficient coverage for a reliable comparison.
                          </p>
                        )}
                        {l.source === 'mobile' && (
                          <p className="micro">
                            Mobile sampling differs from a continuous fixed
                            site.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
                {ids.length < 2 ? (
                  <Note>
                    Add another place to compare two or three locations.
                  </Note>
                ) : (
                  <>
                    <div className="panel">
                      <HistoryChart
                        data={data}
                        ids={ids}
                        metric={metric}
                        hours={hours}
                      />
                    </div>
                    <Note
                      warning={ids.some(
                        (id) =>
                          summary(
                            data.observations,
                            id,
                            metric,
                            hours,
                            data.clock,
                          ).coverage < 75,
                      )}
                    >
                      {ids.some(
                        (id) =>
                          summary(
                            data.observations,
                            id,
                            metric,
                            hours,
                            data.clock,
                          ).coverage < 75,
                      )
                        ? 'Not sufficiently comparable: at least one location has less than 75% valid hourly coverage. '
                        : ''}
                      All summaries use the same window ending{' '}
                      {fmtTime(data.clock)} and 1-hour averages. Different
                      placement, terrain and mobile sampling limit comparisons.
                      No overall safety score is calculated.
                    </Note>
                  </>
                )}
              </>
            ) : (
              <EmptyState title="A little perspective starts with two places.">
                Add up to three supported places above, or select Compare from a
                location in <Link href="/explore">Explore</Link>.
              </EmptyState>
            )}
          </>
        )}
      </DataGuard>
    </div>
  );
}

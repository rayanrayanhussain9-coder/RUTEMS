'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bell, Check, Trash2, Bookmark, ArrowUpRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  type Metric,
  type Watch,
  metrics,
  fmtTime,
  evaluateWatch,
} from '@/lib/rutems/domain';

import {
  useApp,
  DataBanner,
  DataGuard,
  Button,
  Choice,
  MetricChoice,
  Note,
  EmptyState,
} from './shared';
export function Saved() {
  const {
    data,
    saved,
    toggleSave,
    resetSaved,
    watches,
    setWatches,
    notices,
    setNotices,
    announce,
  } = useApp();
  const visibleNotices = notices.filter((n) => !n.dismissed);
  const [locationId, setLocationId] = useState(''),
    [metric, setMetric] = useState<Metric>('pm25'),
    [threshold, setThreshold] = useState('50'),
    [hours, setHours] = useState('1'),
    [feedback, setFeedback] = useState('');
  const create = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const n = Number(threshold);
    if (
      !data?.locations.some((l) => l.id === locationId) ||
      threshold.trim() === '' ||
      !Number.isFinite(n) ||
      n < metrics[metric].min ||
      n > metrics[metric].max
    ) {
      setFeedback('Enter a threshold within the supported metric range.');
      return;
    }
    const w: Watch = {
      id: crypto.randomUUID(),
      locationId,
      metric,
      threshold: n,
      hours: Number(hours) as 1 | 24,
    };
    setWatches((old) => [...old, w]);
    setFeedback('Custom watch saved in this browser.');
    announce('Custom watch saved');
  };
  return (
    <div className="wrap page">
      <div className="page-heading">
        <p className="eyebrow">YOUR LOCAL PERSPECTIVE</p>
        <h1>Saved Places & watches</h1>
        <p className="muted">
          Keep a few places close. Your choices stay in this browser.
        </p>
      </div>
      <DataBanner />
      <DataGuard>
        {data && (
          <>
            <section className="saved-section">
              <div className="section-line">
                <h2>
                  <Bookmark size={22} /> Saved Places{' '}
                  <span className="muted">{saved.length}</span>
                </h2>
                <Button
                  variant="ghost"
                  disabled={!saved.length}
                  onClick={resetSaved}
                >
                  Reset saved places
                </Button>
              </div>
              {saved.length ? (
                <div className="saved-grid">
                  {saved.map((id) => {
                    const l = data.locations.find((l) => l.id === id);
                    return (
                      <article key={id}>
                        <div>
                          <h3>{l?.name ?? id}</h3>
                          <p className="micro">
                            {l
                              ? `${l.region} · ${l.source}`
                              : 'Unavailable in this data mode'}
                          </p>
                        </div>
                        <Link
                          className="button"
                          href={'/locations/' + id}
                          aria-label={`Open ${l?.name ?? id}`}
                        >
                          <ArrowUpRight size={16} />
                        </Link>
                        <Button
                          variant="ghost"
                          aria-label={`Unsave ${l?.name ?? id}`}
                          onClick={() => toggleSave(id)}
                        >
                          <Trash2 />
                        </Button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="Your places will feel at home here.">
                  Save any supported location from{' '}
                  <Link href="/explore">Explore</Link> to return to it later.
                </EmptyState>
              )}
            </section>
            <section className="watches-section">
              <div className="page-heading">
                <h2>Custom observation thresholds</h2>
                <p className="muted">
                  Your own rules, not medical guidance or official warning
                  levels.
                </p>
              </div>
              <Note>
                Watches are evaluated while this app is open, using recent
                observations that pass basic checks and at least 75% window
                coverage. Missing or stale data is not an all-clear. There is no
                guaranteed background monitoring, email, SMS or push delivery.
              </Note>
              {data.mode === 'real' ? (
                <>
                  <form className="watch-form" onSubmit={create}>
                    <Choice
                      label="Watch location"
                      value={locationId}
                      onChange={setLocationId}
                      options={data.locations.map((l) => ({
                        value: l.id,
                        label: l.name,
                      }))}
                    />
                    <MetricChoice value={metric} onChange={setMetric} />
                    <Choice
                      label="Averaging window"
                      value={hours}
                      onChange={setHours}
                      options={[
                        { value: '1', label: '1 hour' },
                        { value: '24', label: '24 hours' },
                      ]}
                    />
                    <label className="threshold-input">
                      <span className="control-label">
                        Above {metrics[metric].unit || 'UV index'}
                      </span>
                      <Input
                        aria-label="Threshold value"
                        type="number"
                        step="any"
                        min={metrics[metric].min}
                        max={metrics[metric].max}
                        value={threshold}
                        onChange={(e) => setThreshold(e.target.value)}
                        required
                      />
                    </label>
                    <Button type="submit">
                      <Bell /> Create watch
                    </Button>
                  </form>
                  <output className="form-feedback">{feedback}</output>
                  <div className="watch-list">
                    {watches.map((w) => {
                      const result = evaluateWatch(w, data);
                      return (
                        <article key={w.id}>
                          <div>
                            <h3>
                              {data.locations.find((l) => l.id === w.locationId)
                                ?.name ?? w.locationId}
                            </h3>
                            <p>
                              {metrics[w.metric].name} above{' '}
                              <strong>
                                {w.threshold} {metrics[w.metric].unit}
                              </strong>{' '}
                              · {w.hours}-hour average
                            </p>
                            <p
                              className={
                                result.notice ? 'watch-exceeded' : 'micro'
                              }
                            >
                              {result.state}
                            </p>
                          </div>
                          <div className="actions">
                            <Button
                              variant="ghost"
                              aria-label="Remove watch"
                              onClick={() =>
                                setWatches((old) =>
                                  old.filter((x) => x.id !== w.id),
                                )
                              }
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Note>
                  Watch processing requires connected device observations.
                </Note>
              )}
            </section>
            <section className="notice-section">
              <div className="section-line">
                <h2>
                  <Bell size={22} /> In-app notices
                </h2>
                <Button
                  variant="ghost"
                  disabled={!visibleNotices.some((n) => n.acknowledged)}
                  onClick={() =>
                    setNotices((old) =>
                      old.map((n) =>
                        n.acknowledged ? { ...n, dismissed: true } : n,
                      ),
                    )
                  }
                >
                  Clear acknowledged
                </Button>
              </div>
              {visibleNotices.length ? (
                <div className="notice-list">
                  {visibleNotices.map((n) => (
                    <article
                      key={n.id}
                      className={n.acknowledged ? 'acknowledged' : ''}
                    >
                      <div className="notice-icon">
                        {n.acknowledged ? (
                          <Check size={21} />
                        ) : (
                          <Bell size={21} />
                        )}
                      </div>
                      <div>
                        <span className="badge">
                          Observation notice ·{' '}
                          {n.acknowledged ? 'Acknowledged' : 'Unacknowledged'}
                        </span>
                        <h3>
                          {data.locations.find((l) => l.id === n.locationId)
                            ?.name ?? n.locationId}{' '}
                          · Custom threshold exceeded
                        </h3>
                        <p>
                          {metrics[n.metric].name}:{' '}
                          <strong>
                            {n.value.toFixed(1)} {metrics[n.metric].unit}
                          </strong>{' '}
                          · your rule: above {n.threshold} over {n.hours}{' '}
                          hour(s).
                        </p>
                        <p className="micro">
                          Observation {n.observationId} · measured{' '}
                          {fmtTime(n.measuredAt)}
                        </p>
                        <p className="micro">
                          Recorded event; does not claim current conditions.
                          Nothing was sent outside this app.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        disabled={n.acknowledged}
                        onClick={() =>
                          setNotices((old) =>
                            old.map((x) =>
                              x.id === n.id ? { ...x, acknowledged: true } : x,
                            ),
                          )
                        }
                      >
                        {n.acknowledged ? 'Acknowledged' : 'Acknowledge'}
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="No threshold events recorded.">
                  A notice appears when an eligible observation exceeds one of
                  your custom rules. Absence of a notice does not mean
                  favourable conditions.
                </EmptyState>
              )}
            </section>
          </>
        )}
      </DataGuard>
    </div>
  );
}

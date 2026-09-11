'use client';
import { useState } from 'react';
import {
  type Snapshot,
  type Metric,
  series,
  metrics,
  fmtTime,
} from '@/lib/rutems/domain';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Segments } from './shared';
export function HistoryChart({
  data,
  ids,
  metric,
  hours,
}: {
  data: Snapshot;
  ids: string[];
  metric: Metric;
  hours: number;
}) {
  const [view, setView] = useState('chart');
  const [page, setPage] = useState(0);
  const sets = ids.map((id) => ({
    id,
    name: data.locations.find((l) => l.id === id)?.name ?? id,
    points: series(data.observations, id, metric, hours, data.clock),
  }));
  const all = sets.flatMap((s) =>
    s.points.flatMap((x) => (x.value === null ? [] : [x.value])),
  );
  const min = all.length ? Math.min(...all) : 0,
    max = all.length ? Math.max(...all) : 1;
  const pad = Math.max((max - min) * 0.2, 1);
  const low = min - pad,
    high = max + pad;
  const X = (i: number) => 50 + (i / (hours - 1)) * 810,
    Y = (v: number) => 180 - ((v - low) / (high - low)) * 155;
  const colours = ['#2f644c', '#956440', '#426fa4'];
  const pageCount = Math.ceil(hours / 24),
    safePage = Math.min(page, pageCount - 1);
  return (
    <div className="history">
      <div className="section-line">
        <span className="micro">
          Hourly averages · {metrics[metric].unit || 'UV index'} · IST
        </span>
        <Segments
          label="History presentation"
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: 'Chart' },
            { value: 'table', label: 'Data table' },
          ]}
        />
      </div>
      {view === 'chart' ? (
        <>
          <svg
            viewBox="0 0 900 220"
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG requires an explicit accessible image role.
            role="img"
            aria-label={`${metrics[metric].name} history over ${hours} hours. Missing or non-valid observations are gaps. Use the Data table tab for exact values.`}
          >
            {[0, 1, 2, 3].map((i) => {
              const v = low + ((high - low) * i) / 3;
              return (
                <g key={i}>
                  <line x1="50" x2="860" y1={Y(v)} y2={Y(v)} stroke="#e1e6dc" />
                  <text
                    x="40"
                    y={Y(v) + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill="#647267"
                  >
                    {v.toFixed(0)}
                  </text>
                </g>
              );
            })}
            {sets.map((s, k) => {
              const paths: string[] = [];
              let p = '';
              s.points.forEach((v, i) => {
                if (v.value === null) {
                  if (p) paths.push(p);
                  p = '';
                } else p += `${p ? ' L' : 'M'} ${X(i)} ${Y(v.value)}`;
              });
              if (p) paths.push(p);
              return (
                <g key={s.id}>
                  {paths.map((d, j) => (
                    <path
                      key={j}
                      d={d}
                      fill="none"
                      stroke={colours[k]}
                      strokeWidth="2.5"
                    />
                  ))}
                  {s.points.map((v, i) =>
                    v.value !== null ? (
                      <circle
                        key={i}
                        cx={X(i)}
                        cy={Y(v.value)}
                        r={hours === 24 ? 2.6 : 1.5}
                        fill={colours[k]}
                      />
                    ) : null,
                  )}
                </g>
              );
            })}
            {[0, Math.floor((hours - 1) / 2), hours - 1].map((i) => (
              <text
                key={i}
                x={X(i)}
                y="209"
                textAnchor={
                  i === 0 ? 'start' : i === hours - 1 ? 'end' : 'middle'
                }
                fill="#647267"
                fontSize="12"
              >
                {fmtTime(
                  sets[0]?.points[i]?.at ?? data.clock,
                  hours > 24,
                ).replace(' IST', '')}
              </text>
            ))}
          </svg>
          <div className="chart-legend">
            {sets.map((s, i) => (
              <span key={s.id}>
                <i style={{ background: colours[i] }} />
                {s.name}
              </span>
            ))}
          </div>
          <p className="micro">
            Gaps indicate absent, missing, suspect or invalid measurements.
            Lines do not bridge gaps.
          </p>
        </>
      ) : (
        <>
          <Table>
            <caption className="sr-only">
              Hourly {metrics[metric].name} observations, {metrics[metric].unit}
              ; all times IST
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Hour ending (IST)</TableHead>
                {sets.map((s) => (
                  <TableHead key={s.id}>{s.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sets[0]?.points
                .slice(safePage * 24, safePage * 24 + 24)
                .map((p, i) => (
                  <TableRow key={p.at}>
                    <TableCell>{fmtTime(p.at)}</TableCell>
                    {sets.map((s) => {
                      const point = s.points[safePage * 24 + i];
                      return (
                        <TableCell key={s.id}>
                          {point.value === null
                            ? '— Missing / excluded'
                            : `${point.value.toFixed(1)} ${metrics[metric].unit}`}
                          <span className="table-meta">
                            {point.observation
                              ? `${point.observation.quality} · measured ${fmtTime(point.observation.measuredAt)}`
                              : 'No observation'}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          {hours > 24 && (
            <div className="pagination">
              <button
                className="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous day
              </button>
              <span>
                Page {safePage + 1} of {pageCount}
              </span>
              <button
                className="button"
                disabled={safePage === pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next day
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

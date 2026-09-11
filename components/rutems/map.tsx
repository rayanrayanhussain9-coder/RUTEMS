'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import { Layers, MapPin, LocateFixed } from 'lucide-react';
import {
  type Location,
  type Snapshot,
  type Metric,
  latest,
  freshness,
  valueOf,
  metrics,
} from '@/lib/rutems/domain';
import { Button } from './shared';
import 'leaflet/dist/leaflet.css';
export default function ObservationMap({
  locations,
  data,
  metric,
  selected,
  onSelect,
  region = 'Delhi',
  preview = false,
}: {
  locations: Location[];
  data: Snapshot;
  metric: Metric;
  selected?: string;
  onSelect: (id: string) => void;
  region?: string;
  preview?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    layer = useRef<LayerGroup | null>(null),
    [ready, setReady] = useState(false),
    [tiles, setTiles] = useState(true),
    [failed, setFailed] = useState(false);
  const callback = useRef(onSelect);
  useEffect(() => {
    callback.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver;
    void import('leaflet').then((L) => {
      if (disposed || !element.current) return;
      const m = L.map(element.current, {
        scrollWheelZoom: false,
        zoomControl: !preview,
        attributionControl: true,
      }).setView([28.61, 77.23], 13);
      map.current = m;
      layer.current = L.layerGroup().addTo(m);
      observer = new ResizeObserver(() => m.invalidateSize());
      observer.observe(element.current);
      setReady(true);
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, [preview]);
  useEffect(() => {
    if (!ready || !map.current) return;
    let tile: import('leaflet').TileLayer | undefined;
    let cancelled = false;
    setFailed(false);
    if (tiles)
      void import('leaflet').then((L) => {
        if (cancelled || !map.current) return;
        const url =
          (import.meta as ImportMeta & { env: Record<string, string> }).env
            ?.VITE_RUTEMS_TILE_URL ||
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        tile = L.tileLayer(url, {
          maxZoom: 16,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
          keepBuffer: 1,
        });
        tile.on('tileerror', () => setFailed(true));
        tile.addTo(map.current);
      });
    return () => {
      cancelled = true;
      tile?.remove();
    };
  }, [ready, tiles]);
  useEffect(() => {
    if (!ready || !map.current) return;
    void import('leaflet').then((L) => {
      if (!map.current || !layer.current) return;
      layer.current.clearLayers();
      locations.forEach((l) => {
        const obs = latest(data.observations, l.id),
          state = freshness(obs, data.clock, data.freshMinutes),
          value = valueOf(obs, metric);
        const style =
          state === 'Recent' && obs?.quality === 'valid'
            ? 'recent'
            : state === 'Invalid'
              ? 'invalid'
              : state === 'Unavailable'
                ? 'unavailable'
                : 'stale';
        const icon = L.divIcon({
          className: 'observation-pin',
          html: `<span class="pin-body ${style} ${l.source} ${l.id === selected ? 'selected' : ''}"><span>${l.source === 'mobile' ? '◇' : '●'}</span> ${value === null ? '—' : value.toFixed(1)}</span>`,
          iconSize: [76, 36],
          iconAnchor: [38, 18],
        });
        const marker = L.marker([l.lat, l.lng], {
          icon,
          title: `${l.name}: ${value ?? 'unavailable'} ${metrics[metric].unit}, ${state}`,
          alt: l.name,
          keyboard: true,
        }).addTo(layer.current!);
        marker
          .getElement()
          ?.setAttribute(
            'aria-label',
            `${l.name}: ${value ?? 'unavailable'} ${metrics[metric].unit}, ${state}`,
          );
        marker.getElement()?.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            callback.current(l.id);
          }
        });
        marker.on('click', () => callback.current(l.id));
        if (l.id === selected)
          L.circle([l.lat, l.lng], {
            radius: l.uncertaintyM,
            color: '#285840',
            weight: 1,
            fillOpacity: 0.08,
            dashArray: '4 5',
          }).addTo(layer.current!);
      });
    });
  }, [ready, locations, data, metric, selected]);
  const recenter = useCallback(() => {
    if (!map.current) return;
    if (locations.length)
      map.current.fitBounds(
        locations.map((l) => [l.lat, l.lng] as [number, number]),
        { padding: [35, 35], maxZoom: 13, animate: false },
      );
    else map.current.setView([22.5, 79], 4, { animate: false });
  }, [locations]);
  useEffect(() => {
    if (ready) recenter();
  }, [ready, recenter]);
  return (
    <div className={'map-shell' + (preview ? ' map-preview' : '')}>
      <section
        ref={element}
        className="map-canvas"
        aria-label="Observation map. The location list provides a keyboard accessible alternative."
      />
      {!preview && (
        <div className="map-tools">
          <span className="map-label">
            <MapPin size={14} />
            {region === 'all' ? 'Published areas' : region}
          </span>
          <Button
            variant="outline"
            aria-label={tiles ? 'Hide basemap' : 'Show basemap'}
            onClick={() => setTiles((v) => !v)}
          >
            <Layers size={16} />
          </Button>
          <Button
            variant="outline"
            aria-label="Recenter map"
            onClick={recenter}
          >
            <LocateFixed size={16} />
          </Button>
        </div>
      )}
      {(!tiles || failed) && (
        <output className="map-fallback">
          {tiles ? 'Map tiles unavailable or incomplete.' : 'Basemap hidden.'}{' '}
          Use the observation list; readings remain available.
        </output>
      )}
      <div className="map-legend">
        <strong>
          {metrics[metric].name}{' '}
          <span className="muted">{metrics[metric].unit}</span>
        </strong>
        <div>
          <span>● Fixed area</span>
          <span>◇ Mobile area</span>
        </div>
        <p>Blank coverage = Insufficient data</p>
      </div>
      <div className="map-footnote">
        {data.mode === 'demo' ? 'Fictional positions · ' : ''}Generalized public
        areas
      </div>
    </div>
  );
}

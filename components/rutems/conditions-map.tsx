'use client';
import { useMemo, useState } from 'react';
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
    pm25: 22, pm10:48, pressure:1008, uv:2, aqi:46,
    temperature: 27,
    humidity: 56,
  },
  {
    id: 'gate',
    name: 'India Gate',
    lat: 28.6129,
    lng: 77.2295,
    pm25: 134, pm10:221, pressure:1005, uv:9, aqi:316,
    temperature: 29,
    humidity: 51,
  },
  {
    id: 'river',
    name: 'Yamuna riverbank',
    lat: 28.621,
    lng: 77.253,
    pm25: 76, pm10:125, pressure:1006, uv:6, aqi:171,
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
    description: 'Sample station.',
  })),
  observations: sites.map(({ id, lat, lng, pm25, temperature, humidity, pm10, pressure, uv }) => ({
    id: 'sample-' + id,
    deviceId: 'class-' + id,
    locationId: id,
    lat,
    lng,
    uncertaintyM: 150,
    measuredAt: clock,
    receivedAt: clock,
    averagingSeconds: 3600,
    raw: { ...emptyValues(), pm25, pm10, pressure, uv, temperature, humidity },
    corrected: null,
    quality: 'valid',
    flags: [],
    calibrationVersion: 'classroom',
    demo: true,
  })),
};
type Layer = Metric | 'aqi';
const layers = ['aqi','uv','pm25','pm10','temperature','humidity','pressure'] as const;
const name = (m:Layer)=>m==='aqi'?'Air Quality Index':metrics[m].name;
const unit = (m:Layer)=>m==='aqi'?'':metrics[m].unit;
const palette=['#245d91','#146956','#906000','#ad4711','#ac273d','#6a263e'];
function scale(m:Layer){
 if(m==='aqi')return {limits:[50,100,200,300,400],labels:['Good','Satisfactory','Moderate','Poor','Very poor','Severe'],colors:['#267339','#598121','#896500','#b45010','#ae2635','#6a2032']};
 if(m==='uv')return {limits:[2,5,7,10],labels:['Low','Moderate','High','Very high','Extreme'],colors:['#267339','#896500','#b45010','#ae2635','#682c89']};
 const values=sites.map(s=>s[m]).sort((a,b)=>a-b);
 return {limits:[values[0],values[1]],labels:['Lower in this view','Middle in this view','Higher in this view'],colors:[palette[0],palette[1],palette[3]]};
}
export function ConditionsMap({onExit}:{onExit:()=>void}){
 const [layer,setLayer]=useState<Layer>('aqi'),[id,select]=useState('gate');
 const site=sites.find(s=>s.id===id)!;
 const overlay=useMemo(()=>{const sc=scale(layer);return {name:name(layer),unit:unit(layer),points:Object.fromEntries(sites.map(s=>{const value=s[layer];let i=sc.limits.findIndex(limit=>value<=limit);if(i<0)i=sc.labels.length-1;return [s.id,{value,label:sc.labels[i],color:sc.colors[i]}]}))}},[layer]);
 const sc=scale(layer);
 return <section className="app-wrap conditions"><div className="conditions-heading"><div><p className="eyebrow">EXPLORE / DELHI</p><h1>Environmental atlas</h1><p>Choose a layer to see how conditions vary by station.</p></div><Button onClick={onExit}>Live device map →</Button></div>
 <p className="sample-note"><strong>Sample data</strong> · 9 Sep 2026, 11:00 IST · Illustrative station values</p>
 <div className="layer-picker" aria-label="Map layers">{layers.map(m=><button key={m} aria-pressed={m===layer} onClick={()=>setLayer(m)}>{name(m)}</button>)}</div>
 <div className="conditions-grid"><div><ObservationMap data={data} locations={data.locations} metric={layer==='aqi'?'pm25':layer} selected={id} onSelect={select} region="Delhi" overlay={overlay}/>
 <div className="band-key">{sc.labels.map((label,i)=><span key={label}><i style={{background:sc.colors[i]}}/>{label}{layer==='aqi'||layer==='uv'?' · '+(i===0?'0':sc.limits[i-1]+1)+(i<sc.limits.length?'–'+sc.limits[i]:layer==='aqi'?'–500':'+'):''}</span>)}</div></div>
 <aside className="station-card"><p className="eyebrow">STATION DETAILS</p><label>Station <select value={id} onChange={e=>select(e.target.value)}>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><h2>{site.name}</h2><p aria-live="polite"><strong style={{color:overlay.points[id].color}}>{site[layer]} {unit(layer)} · {overlay.points[id].label}</strong></p><dl>{layers.map(m=><div key={m}><dt>{name(m)}</dt><dd>{site[m]} {unit(m)}</dd></div>)}</dl></aside></div>
 <p className="micro">{layer==='aqi'?<>Illustrative scores use <a href="https://ies.gov.in/arthapedia/concept/national-air-quality-index">Indian AQI categories</a>. They are not calculated from the displayed particulate readings.</>:layer==='uv'?<>Colors follow the <a href="https://www.epa.gov/sunsafety/uv-index-scale-0">UV Index scale</a>.</>:'Colors compare the three sample stations; they are not safety ratings.'} Halos mark station locations, not the extent of affected areas.</p></section>
}

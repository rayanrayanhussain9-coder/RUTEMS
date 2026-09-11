'use client';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowUpRight,
  ArrowRight,
  Radar,
  Radio,
  Wifi,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { useApp, Note } from './shared';
import { metrics } from '@/lib/rutems/domain';
export function Home() {
  const { data, error } = useApp();
  return (
    <>
      <section className="hero wrap">
        <div>
          <p className="eyebrow">LOCAL OBSERVATIONS. SHARED CONTEXT.</p>
          <h1>
            Your environment.
            <br />
            <span>Closer to the ground.</span>
          </h1>
          <p className="hero-lede">
            Local environmental insights, from city streets to mountain trails.
          </p>
          <p className="muted">
            Explore observations from fixed and mobile devices. See what was
            measured, where it was collected, and how much we know.
          </p>
          <div className="actions">
            <Link className="button primary" href="/explore">
              Explore observations <ArrowRight size={18} />
            </Link>
            <Link className="button" href="/how-it-works">
              How it works <ArrowUpRight size={18} />
            </Link>
          </div>
          <p className="micro">
            Coverage depends on registered, reporting devices.
          </p>
        </div>
        <div className="hero-map-card">
          <div className="section-line">
            <span className="eyebrow">THE OBSERVATION NETWORK</span>
            <span className="badge">Device data</span>
          </div>
          <div className="home-map-empty">
            <Radar size={48} />
            <h2>
              {error
                ? 'Observations unavailable'
                : data?.locations.length
                  ? `${data.locations.length} published observation areas`
                  : 'Awaiting published observations'}
            </h2>
            <p>
              {error
                ? 'The data service could not be reached. Please retry in Explore.'
                : 'Registered devices appear after an administrator publishes their observation area. Missing coverage is not a favourable reading.'}
            </p>
            <Link className="text-link" href="/explore">
              Open explorer <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="intro-strip wrap">
        <p>
          REAL-TIME URBAN & TRAIL
          <br />
          ENVIRONMENTAL MONITORING SYSTEM
        </p>
        <p>Particulate matter. Temperature. Humidity. Pressure. UV.</p>
        <span className="badge">Limited coverage</span>
      </section>
      <section className="section wrap">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FROM CITY STREETS TO MOUNTAIN TRAILS</p>
            <h2>A closer look at the places around us.</h2>
          </div>
          <p className="muted">
            Fixed devices observe selected sites over time. Mobile devices add
            observations along travelled routes. Neither guarantees complete
            coverage.
          </p>
        </div>
        <div className="landscape-grid">
          <article>
            <div className="landscape-image">
              <Image
                src="/images/lodhi-garden.jpg"
                width={900}
                height={550}
                unoptimized
                alt="Historic architecture and gardens at Lodhi Gardens, Delhi"
              />
            </div>
            <div className="landscape-copy">
              <h3>The urban perspective.</h3>
              <p>
                Understand measured differences across monitored sites. A
                reading describes its collection context, not an entire
                neighbourhood.
              </p>
              <p className="photo-credit">
                Lodhi Gardens · Muskan Rai · CC BY-SA 4.0 · illustrative image,
                not evidence of deployment
              </p>
            </div>
          </article>
          <article>
            <div className="landscape-image">
              <Image
                src="/images/mussoorie-forest.jpg"
                width={900}
                height={550}
                unoptimized
                alt="Mist over wooded hills in Mussoorie"
              />
            </div>
            <div className="landscape-copy">
              <h3>The trail perspective.</h3>
              <p>
                Explore observations from monitored hill environments, while
                keeping placement, uncertainty and coverage in view.
              </p>
              <p className="photo-credit">
                Mussoorie forest · Vinko Rajic · CC BY 3.0 · illustrative image,
                not evidence of deployment
              </p>
            </div>
          </article>
        </div>
      </section>
      <section className="system-section">
        <div className="wrap section">
          <h2>From the sensor to your screen.</h2>
          <SystemDiagram />
          <Link href="/how-it-works" className="text-link">
            See how it works <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="pilot-note wrap section">
        <span className="badge">DEPLOYMENT STATUS</span>
        <h2>Real records. Transparent limitations.</h2>
        <p>
          The application accepts registered device observations. Hardware
          deployment and scientific validation must be established separately.
          No observation is a guarantee of personal safety.
        </p>
        <div className="actions">
          <Link href="/methods">Data & Methods</Link>
          <Link href="/privacy">Privacy & image credits</Link>
        </div>
      </section>
    </>
  );
}
function SystemDiagram() {
  return (
    <div className="system-diagram">
      {[
        [Radio, 'Sensors', 'Fixed, wearable or vehicle-mounted'],
        [Wifi, 'Connection', 'Authenticated device uploads'],
        [ShieldCheck, 'Quality checks', 'Values, time and duplicate checks'],
        [Database, 'Storage', 'Original records and metadata'],
        [Radar, 'Public display', 'Published areas and observations'],
      ].map(([Icon, title, copy]) => {
        const Symbol = Icon as typeof Radar;
        return (
          <div key={String(title)}>
            <Symbol size={26} />
            <strong>{String(title)}</strong>
            <p>{String(copy)}</p>
          </div>
        );
      })}
    </div>
  );
}
export function HowItWorks() {
  return (
    <div className="wrap page prose-page">
      <p className="eyebrow">HOW IT WORKS</p>
      <h1>Every reading has a story.</h1>
      <SystemDiagram />
      <h2>A steady view from fixed devices.</h2>
      <p>
        Fixed devices observe selected locations over time. Their position,
        sensor model and calibration help explain what the readings represent.
      </p>
      <h2>Observations along travelled routes.</h2>
      <p>
        Wearable and vehicle-mounted devices record conditions as they move. The
        public map uses generalized observation areas and does not expose
        personal trajectories.
      </p>
      <h2>From upload to interpretation.</h2>
      <p>
        Each device authenticates separately. The service checks values and
        timestamps, identifies duplicates and preserves measurement time even
        when an upload is delayed. Operators investigate quality issues and
        maintenance needs.
      </p>
      <Note>
        A recent reading means it is within the configured freshness window. It
        does not establish scientific accuracy or personal safety.
      </Note>
      <Link className="button" href="/explore">
        Explore observations
      </Link>
    </div>
  );
}
export function Methods() {
  return (
    <div className="wrap page prose-page">
      <p className="eyebrow">DATA & METHODS</p>
      <h1>Understand the measurement before the number.</h1>
      <p>
        Observations describe conditions at a particular place and time.
        Coverage, placement, averaging and calibration affect their
        interpretation.
      </p>
      {Object.entries(metrics).map(([key, m]) => (
        <section key={key}>
          <h2>
            {m.name} {m.unit}
          </h2>
          <p>
            {m.description}. Review the observation time, source and quality
            label alongside the value.
          </p>
        </section>
      ))}
      <h2>Quality and freshness</h2>
      <p>
        “Valid” means an observation passed implemented input checks; it does
        not mean independently validated. “Suspect” records need review and are
        excluded from comparison means and watch evaluation. Invalid and absent
        readings are never replaced with zero.
      </p>
      <p>
        The current freshness window is 90 minutes. It is a product rule, not a
        confidence score. The application displays times in IST and stores
        timezone-aware timestamps.
      </p>
      <h2>Historical comparisons</h2>
      <p>
        Current cards show the latest available observation and its actual
        averaging period. Historical comparisons currently use one-hour
        observations only. Shorter-interval uploads are stored and available to
        staff, but are not silently relabelled as hourly averages. A future
        aggregation service must establish completeness rules before including
        them in hourly charts.
      </p>
      <p>
        History and comparisons use the same time window; missing records remain
        gaps. Watches require recent eligible data and at least 75% window
        coverage. They run while the application is open and do not guarantee
        background delivery.
      </p>
      <h2>What these readings do not establish</h2>
      <p>
        Particulate concentrations alone are not a complete official Indian AQI.
        Pressure alone does not predict storms, humidity does not predict
        landslides, and these sensors do not diagnose altitude illness. No
        personal medical clearance or route-safety rating is provided.
      </p>
      <Note>Official warning feed not connected.</Note>
      <h2>Measured, estimated and forecast information</h2>
      <p>
        Device observations are measurements, subject to sensor limitations.
        Generalized area coordinates describe public display positions. The
        application does not currently provide weather forecasts or interpolated
        coverage.
      </p>
      <h2>Sources</h2>
      <ul>
        <li>
          <a href="https://cpcb.gov.in/National-Air-Quality-Index/">
            CPCB — National Air Quality Index
          </a>
        </li>
        <li>
          <a href="https://www.epa.gov/air-sensor-toolbox">
            US EPA — Air Sensor Toolbox
          </a>
        </li>
        <li>
          <a href="https://www.who.int/news-room/fact-sheets/detail/ultraviolet-radiation">
            WHO — Ultraviolet radiation
          </a>
        </li>
        <li>
          <a href="https://api.imd.gov.in/public/api_reference.html">
            IMD — Official API reference
          </a>
        </li>
      </ul>
    </div>
  );
}
export function Privacy() {
  return (
    <div className="wrap page prose-page">
      <p className="eyebrow">PRIVACY & ATTRIBUTION</p>
      <h1>Only the information the task needs.</h1>
      <h2>Accounts and access</h2>
      <p>
        Supabase stores account identities and project records. Staff
        permissions are assigned by an administrator and checked by the
        database. Authentication sessions keep you signed in. Device credentials
        are separate from staff passwords.
      </p>
      <h2>Public and operational records</h2>
      <p>
        The public interface shows published observation areas and measurement
        records. Precise device coordinates, device credentials and maintenance
        records are restricted. Public exports do not identify individual
        workers or publish their tracks.
      </p>
      <h2>Your browser</h2>
      <p>
        Saved places and in-app watches remain in this browser. No location
        permission is requested automatically. No production analytics or
        advertising trackers have been added. Map tiles are requested from
        OpenStreetMap, whose servers receive normal connection information.
      </p>
      <h2>Retention and launch status</h2>
      <p>
        Operational retention and archival policy is still being established.
        Device uploads preserve raw measurements; corrections require a separate
        reviewed process. Contact the project administrator about account and
        operational record requests.
      </p>
      <h2>Image credits</h2>
      <p>
        <a href="https://commons.wikimedia.org/wiki/File:The_Lodhi_Gardens.jpg">
          The Lodhi Gardens
        </a>{' '}
        — Muskan Rai, 2017,{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">
          CC BY-SA 4.0
        </a>
        . Cropped in display.
      </p>
      <p>
        <a href="https://commons.wikimedia.org/wiki/File:Forest_-_Mussorie_-_panoramio.jpg">
          Forest — Mussorie
        </a>{' '}
        — Vinko Rajic, 2003,{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>.
        Cropped in display.
      </p>
      <p>
        Map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright">
          OpenStreetMap contributors
        </a>
        . Photography illustrates environments and does not imply devices are
        deployed there.
      </p>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from './auth';
import { requireSupabase } from '@/lib/rutems/supabase';
import { Button, Choice, EmptyState } from './shared';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fmtTime } from '@/lib/rutems/domain';
import { download } from '@/lib/rutems/data-access';
type Device = {
  id: string;
  name: string;
  area_id: string;
  deployment: string;
  state: string;
  last_contact: string | null;
  battery: number | null;
  sensor_model: string;
  firmware_version: string;
  calibration_version: string;
  upload_interval_seconds: number;
  latitude: number;
  longitude: number;
};
type Area = {
  id: string;
  name: string;
  region: string;
  published: boolean;
  created_by: string;
};
type Event = {
  id: string;
  device_id: string;
  note: string;
  created_at: string;
};
export function Operator() {
  const { user, role, loading, aal } = useAuth();
  const loadGeneration = useRef(0);
  const [checkedAt, setCheckedAt] = useState(0);
  const [issues, setIssues] = useState<
    {
      id: string;
      device_id: string;
      reason: string;
      status: string;
      note: string;
      created_at: string;
    }[]
  >([]);
  const [rename, setRename] = useState(''),
    [firmware, setFirmware] = useState(''),
    [calibration, setCalibration] = useState('');
  const [staffEmail, setStaffEmail] = useState(''),
    [staffRole, setStaffRole] = useState('operator'),
    [staffActive, setStaffActive] = useState('true');
  const [staff, setStaff] = useState<
    { email: string; role: string; active: boolean }[]
  >([]);
  const [devices, setDevices] = useState<Device[]>([]),
    [areas, setAreas] = useState<Area[]>([]),
    [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState(''),
    [feedback, setFeedback] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(''),
    [note, setNote] = useState(''),
    [credential, setCredential] = useState('');
  const [area, setArea] = useState({
    name: '',
    region: '',
    context: 'urban',
    source: 'fixed',
    latitude: '',
    longitude: '',
    uncertainty: '100',
    description: '',
  });
  const [device, setDevice] = useState({
    name: '',
    area_id: '',
    deployment: 'fixed',
    latitude: '',
    longitude: '',
    sensor_model: '',
    firmware_version: '',
    calibration_version: 'unverified',
    upload_interval_seconds: '60',
  });
  const reload = async () => {
    const generation = ++loadGeneration.current;
    try {
      const db = requireSupabase();
      const [d, a, e, q] = await Promise.all([
        db
          .from('devices')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        db
          .from('observation_areas')
          .select('id,name,region,published,created_by')
          .order('name')
          .limit(500),
        db
          .from('maintenance_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        db
          .from('quality_issues')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (generation !== loadGeneration.current) return;
      if (d.error || a.error || e.error || q.error)
        throw d.error || a.error || e.error || q.error;
      setDevices(d.data || []);
      setAreas(a.data || []);
      setEvents(e.data || []);
      setIssues(q.data || []);
      setError('');
      setReady(true);
      setCheckedAt(Date.now());
    } catch (e) {
      if (generation !== loadGeneration.current) return;
      setError(
        typeof e === 'object' && e && 'message' in e
          ? String(e.message)
          : 'Could not load workspace.',
      );
    }
  };
  useEffect(() => {
    /* oxlint-disable react/react-compiler -- Read external authenticated records after identity changes. */
    if (role && (role !== 'admin' || aal === 'aal2')) void reload();
    else {
      setDevices([]);
      setAreas([]);
      setEvents([]);
      setCredential('');
      setIssues([]);
      setStaff([]);
      setSelected('');
      setReady(false);
    }
    return () => {
      // Invalidate the latest request, not the generation captured at effect setup.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      loadGeneration.current++;
    };
    /* oxlint-enable react/react-compiler */
  }, [role, user?.id, aal]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFeedback('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setFeedback(
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'message' in e
            ? String(e.message)
            : 'The operation failed.',
      );
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return <div className="wrap page">Checking workspace access…</div>;
  if (!user)
    return (
      <div className="wrap page">
        <EmptyState title="Staff sign-in required">
          <Link href="/login">Sign in to open the Operator Workspace</Link>
        </EmptyState>
      </div>
    );
  if (!role)
    return (
      <div className="wrap page">
        <EmptyState title="Staff access has not been assigned">
          Your account cannot access device records. Ask the project
          administrator to assign your role.
        </EmptyState>
        <Link href="/login">Account & access</Link>
      </div>
    );
  if (role === 'admin' && aal !== 'aal2')
    return (
      <div className="wrap page">
        <EmptyState title="Verify administrator access">
          Your password is accepted. Complete authenticator verification to open
          device management.
        </EmptyState>
        <Link className="button" href="/login">
          Verify in Account & access
        </Link>
      </div>
    );
  const selectableAreas = areas.filter(
    (a) => role === 'admin' || a.created_by === user.id,
  );
  const displayState = (d: Device) =>
    d.state === 'retired' || d.state === 'maintenance'
      ? d.state
      : !d.last_contact
        ? 'awaiting first reading'
        : checkedAt - Date.parse(d.last_contact) >
            Math.max(180, d.upload_interval_seconds * 3) * 1000
          ? 'offline'
          : 'reporting';
  const field = (label: string, key: keyof typeof area, type = 'text') => (
    <label>
      {label}
      <Input
        id={key === 'name' ? 'area-name' : undefined}
        type={type}
        required={!['description'].includes(key)}
        minLength={key === 'name' || key === 'region' ? 2 : undefined}
        maxLength={key === 'name' || key === 'region' ? 120 : undefined}
        min={
          key === 'latitude'
            ? -90
            : key === 'longitude'
              ? -180
              : key === 'uncertainty'
                ? 1
                : undefined
        }
        max={
          key === 'latitude'
            ? 90
            : key === 'longitude'
              ? 180
              : key === 'uncertainty'
                ? 100000
                : undefined
        }
        step={key === 'uncertainty' ? 1 : type === 'number' ? 'any' : undefined}
        value={area[key]}
        onChange={(e) => setArea({ ...area, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="wrap page">
      <p className="eyebrow">
        {role === 'admin' ? 'ADMINISTRATOR' : 'OPERATOR'} WORKSPACE
      </p>
      <h1>Devices & operations</h1>
      <p>
        Manage registered devices and their observation areas. Changes are
        stored securely in your project.
      </p>
      {role === 'admin' && (
        <p className="note">
          Administrator access verified. You can manage all devices, publish
          areas, and assign staff permissions.
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={() => void reload()}>Retry workspace</Button>
        </div>
      )}
      <output
        className={
          feedback || busy
            ? 'form-feedback workspace-feedback'
            : 'form-feedback'
        }
        aria-live="polite"
      >
        {busy ? 'Saving changes…' : feedback}
      </output>
      <section className="saved-section">
        <h2>Registered devices</h2>
        {!ready && !error ? (
          <p>Loading devices…</p>
        ) : !devices.length ? (
          <EmptyState title="No devices registered">
            Create an observation area, then register the device that will
            report from it.
          </EmptyState>
        ) : (
          <div className="device-cards">
            {devices.map((d) => (
              <article key={d.id} className="note">
                <div>
                  <h3>{d.name}</h3>
                  <p>
                    {d.deployment} · {displayState(d)} ·{' '}
                    {d.last_contact
                      ? `Last contact ${fmtTime(d.last_contact)}`
                      : 'Awaiting first reading'}
                  </p>
                  <p className="micro">
                    {d.sensor_model} · Calibration: {d.calibration_version} ·
                    Battery:{' '}
                    {d.battery === null ? 'Unavailable' : d.battery + '%'}
                  </p>
                  <p className="micro">Device ID: {d.id}</p>
                  <div className="actions">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelected(d.id);
                        setRename(d.name);
                        setFirmware(d.firmware_version);
                        setCalibration(d.calibration_version);
                        setCredential('');
                      }}
                    >
                      Select device
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const r = await requireSupabase()
                            .from('devices')
                            .update({
                              state:
                                d.state === 'maintenance'
                                  ? 'active'
                                  : 'maintenance',
                            })
                            .eq('id', d.id)
                            .select('id');
                          if (r.error) throw r.error;
                          if (!r.data.length) throw Error('Permission denied.');
                          setFeedback('Maintenance state updated.');
                        })
                      }
                    >
                      {d.state === 'maintenance'
                        ? 'Resume collection'
                        : 'Mark maintenance'}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="operator-forms">
        <section>
          <h2 id="add-observation-area">1. Add observation area</h2>
          <p className="micro">
            These coordinates represent a public area centre. Exact device
            coordinates are entered separately.
          </p>

          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (
                  area.name.trim().length < 2 ||
                  area.region.trim().length < 2
                )
                  throw Error(
                    'Area name and region must contain at least two characters.',
                  );
                const r = await requireSupabase()
                  .from('observation_areas')
                  .insert({
                    name: area.name.trim(),
                    region: area.region.trim(),
                    context: area.context,
                    source: area.source,
                    latitude: Number(area.latitude),
                    longitude: Number(area.longitude),
                    uncertainty_m: Number(area.uncertainty),
                    description: area.description,
                  })
                  .select('id,name,region,published,created_by');
                if (r.error) throw r.error;
                const created = r.data[0];
                setAreas((current) => [...current, created]);
                setDevice((current) => ({ ...current, area_id: created.id }));
                setArea((current) => ({
                  ...current,
                  name: '',
                  description: '',
                }));
                setFeedback(
                  'Observation area created privately. An administrator can publish it.',
                );
              });
            }}
          >
            {field('Area name', 'name')}
            {field('Region', 'region')}
            <Choice
              label="Context"
              value={area.context}
              onChange={(v) => setArea({ ...area, context: v })}
              options={[
                { value: 'urban', label: 'Urban' },
                { value: 'trail', label: 'Trail' },
              ]}
            />
            <Choice
              label="Source type"
              value={area.source}
              onChange={(v) => setArea({ ...area, source: v })}
              options={[
                { value: 'fixed', label: 'Fixed' },
                { value: 'mobile', label: 'Mobile' },
              ]}
            />
            {field('Area latitude', 'latitude', 'number')}
            {field('Area longitude', 'longitude', 'number')}
            {field('Position uncertainty (metres)', 'uncertainty', 'number')}
            {field('Description', 'description')}
            <Button type="submit" disabled={busy || !ready || !!error}>
              Create observation area
            </Button>
          </form>
        </section>
        <section>
          <h2>2. Register device</h2>
          {ready && !error && !selectableAreas.length && (
            <p className="note">
              No observation areas available for your devices.{' '}
              <a
                href="#add-observation-area"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .querySelector<HTMLInputElement>('#area-name')
                    ?.focus();
                }}
              >
                Create an observation area first
              </a>
              . It will be selected here automatically.
            </p>
          )}
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!device.area_id)
                  throw Error('Create and select an observation area first.');
                const r = await requireSupabase()
                  .from('devices')
                  .insert({
                    ...device,
                    name: device.name.trim(),
                    latitude: Number(device.latitude),
                    longitude: Number(device.longitude),
                    upload_interval_seconds: Number(
                      device.upload_interval_seconds,
                    ),
                  })
                  .select('id');
                if (r.error) throw r.error;
                setSelected(r.data[0].id);
                setRename(device.name);
                setFirmware(device.firmware_version);
                setCalibration(device.calibration_version);
                setFeedback(
                  'Device registered. Provision its upload credential before connecting hardware.',
                );
              });
            }}
          >
            <Choice
              label="Observation area"
              value={device.area_id}
              onChange={(v) => setDevice({ ...device, area_id: v })}
              disabled={!ready || !!error || busy}
              placeholder={
                !ready
                  ? 'Loading observation areas…'
                  : error
                    ? 'Areas unavailable — retry above'
                    : !selectableAreas.length
                      ? 'Create an observation area first'
                      : 'Select an observation area'
              }
              options={selectableAreas.map((a) => ({
                value: a.id,
                label: `${a.name} · ${a.region}`,
              }))}
            />
            {(
              [
                ['Device name', 'name'],
                ['Exact latitude', 'latitude'],
                ['Exact longitude', 'longitude'],
                ['Sensor model', 'sensor_model'],
                ['Firmware version', 'firmware_version'],
                ['Calibration version', 'calibration_version'],
                [
                  'Expected upload interval (seconds)',
                  'upload_interval_seconds',
                ],
              ] as const
            ).map(([label, key]) => (
              <label key={key}>
                {label}
                <Input
                  required
                  value={device[key]}
                  type={
                    [
                      'latitude',
                      'longitude',
                      'upload_interval_seconds',
                    ].includes(key)
                      ? 'number'
                      : 'text'
                  }
                  minLength={key === 'name' ? 2 : 1}
                  maxLength={
                    key === 'name'
                      ? 120
                      : key === 'sensor_model'
                        ? 200
                        : undefined
                  }
                  min={
                    key === 'latitude'
                      ? -90
                      : key === 'longitude'
                        ? -180
                        : key === 'upload_interval_seconds'
                          ? 10
                          : undefined
                  }
                  max={
                    key === 'latitude'
                      ? 90
                      : key === 'longitude'
                        ? 180
                        : key === 'upload_interval_seconds'
                          ? 86400
                          : undefined
                  }
                  step={key === 'upload_interval_seconds' ? 1 : 'any'}
                  onChange={(e) =>
                    setDevice({ ...device, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <Choice
              label="Deployment"
              value={device.deployment}
              onChange={(v) => setDevice({ ...device, deployment: v })}
              options={['fixed', 'wearable', 'vehicle'].map((v) => ({
                value: v,
                label: v,
              }))}
            />
            <Button
              type="submit"
              disabled={
                busy ||
                !ready ||
                !!error ||
                !selectableAreas.some((a) => a.id === device.area_id)
              }
            >
              Register device
            </Button>
          </form>
        </section>
      </div>
      <section className="saved-section">
        <h2>Quality issues & rejected uploads</h2>
        {issues.length ? (
          issues.map((q) => (
            <article className="note" key={q.id}>
              <div>
                <h3>
                  {devices.find((d) => d.id === q.device_id)?.name || 'Device'}{' '}
                  · {q.status}
                </h3>
                <p>{q.reason}</p>
                <p className="micro">{fmtTime(q.created_at)}</p>
                <div className="actions">
                  <Button
                    disabled={busy || q.status !== 'open'}
                    variant="outline"
                    onClick={() =>
                      void run(async () => {
                        const r = await requireSupabase()
                          .from('quality_issues')
                          .update({ status: 'acknowledged' })
                          .eq('id', q.id)
                          .select('id');
                        if (r.error) throw r.error;
                        if (!r.data.length) throw Error('Permission denied.');
                        setFeedback('Issue acknowledged.');
                      })
                    }
                  >
                    Acknowledge issue
                  </Button>
                  <Button
                    disabled={busy || q.status === 'resolved'}
                    variant="outline"
                    onClick={() =>
                      void run(async () => {
                        const r = await requireSupabase()
                          .from('quality_issues')
                          .update({ status: 'resolved' })
                          .eq('id', q.id)
                          .select('id');
                        if (r.error) throw r.error;
                        if (!r.data.length) throw Error('Permission denied.');
                        setFeedback(
                          'Issue resolved. Resolution history is in the device maintenance log.',
                        );
                      })
                    }
                  >
                    Resolve issue
                  </Button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <p>
            No rejected uploads recorded. This does not establish sensor
            accuracy.
          </p>
        )}
      </section>
      {selected && (
        <section className="saved-section">
          <h2>
            {devices.find((d) => d.id === selected)?.name || 'Selected device'}
          </h2>
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await requireSupabase()
                  .from('devices')
                  .update({
                    name: rename.trim(),
                    firmware_version: firmware,
                    calibration_version: calibration,
                  })
                  .eq('id', selected)
                  .select('id');
                if (r.error) throw r.error;
                if (!r.data.length) throw Error('Permission denied.');
                setFeedback(
                  'Device details updated. Historical readings retain their original calibration version.',
                );
              });
            }}
          >
            <label htmlFor="edit-device-name">
              Device name
              <Input
                id="edit-device-name"
                required
                minLength={2}
                value={rename}
                onChange={(e) => setRename(e.target.value)}
              />
            </label>
            <label htmlFor="edit-device-firmware">
              Firmware
              <Input
                id="edit-device-firmware"
                required
                value={firmware}
                onChange={(e) => setFirmware(e.target.value)}
              />
            </label>
            <label htmlFor="edit-device-calibration">
              Calibration version
              <Input
                id="edit-device-calibration"
                required
                value={calibration}
                onChange={(e) => setCalibration(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              Save device details
            </Button>
          </form>
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await requireSupabase()
                  .from('maintenance_events')
                  .insert({ device_id: selected, note: note.trim() });
                if (r.error) throw r.error;
                setNote('');
                setFeedback('Maintenance note saved.');
              });
            }}
          >
            <label htmlFor="maintenance-note">
              Maintenance note
              <Textarea
                id="maintenance-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                maxLength={4000}
              />
            </label>
            <Button type="submit" disabled={busy || !note.trim()}>
              Save maintenance note
            </Button>
          </form>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await requireSupabase().rpc('provision_device', {
                  target_device: selected,
                });
                if (r.error) throw r.error;
                setCredential(r.data);
                setFeedback(
                  'New upload credential generated. Any previous credential is now revoked. Save it securely to the device; it is shown only in this view.',
                );
              })
            }
          >
            Generate / rotate upload credential
          </Button>
          {credential && (
            <div>
              <label htmlFor="device-credential">
                Private device credential
                <Input
                  id="device-credential"
                  readOnly
                  value={credential}
                  type="password"
                />
              </label>
              <Button
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(credential);
                    setFeedback('Credential copied.');
                  })
                }
              >
                Copy device credential
              </Button>
              <Button variant="ghost" onClick={() => setCredential('')}>
                Hide credential
              </Button>
            </div>
          )}
          <h3>Maintenance history</h3>
          {events
            .filter((e) => e.device_id === selected)
            .map((e) => (
              <p key={e.id}>
                <strong>{fmtTime(e.created_at)}</strong> — {e.note}
              </p>
            ))}
        </section>
      )}
      {role === 'admin' && (
        <section className="saved-section">
          <h2>Publication controls</h2>
          {!areas.length && (
            <p>
              {error
                ? 'Areas could not be loaded. Retry the workspace above.'
                : !ready
                  ? 'Loading observation areas…'
                  : 'No observation areas yet. Create an area before publishing it.'}
            </p>
          )}
          {areas.map((a) => (
            <div className="section-line" key={a.id}>
              <span>
                {a.name} · {a.published ? 'Published' : 'Private'}
              </span>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    const r = await requireSupabase()
                      .from('observation_areas')
                      .update({ published: !a.published })
                      .eq('id', a.id)
                      .select('id');
                    if (r.error) throw r.error;
                    if (!r.data.length)
                      throw Error('Administrator verification required.');
                    setFeedback('Publication setting updated.');
                  })
                }
              >
                {a.published ? 'Unpublish' : 'Publish area'}
              </Button>
            </div>
          ))}
        </section>
      )}
      {role === 'admin' && (
        <section className="saved-section">
          <h2>Staff access</h2>
          <p>
            For an existing confirmed account, save their staff access below.
            For a new person, send an invitation. Changes are recorded in the
            audit history.
          </p>
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await requireSupabase().rpc('manage_staff', {
                  email_address: staffEmail.trim(),
                  staff_role: staffRole,
                  enabled: staffActive === 'true',
                });
                if (r.error) throw r.error;
                setFeedback('Staff permissions updated.');
                const directory = await requireSupabase().rpc('list_staff');
                if (directory.error) throw directory.error;
                setStaff(directory.data || []);
              });
            }}
          >
            <label htmlFor="staff-email">
              Staff email
              <Input
                id="staff-email"
                required
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
              />
            </label>
            <Choice
              label="Staff role"
              value={staffRole}
              onChange={setStaffRole}
              options={[
                { value: 'operator', label: 'Operator' },
                { value: 'admin', label: 'Administrator' },
              ]}
            />
            <Choice
              label="Staff workspace access"
              value={staffActive}
              onChange={setStaffActive}
              options={[
                { value: 'true', label: 'Enabled — allow staff access' },
                { value: 'false', label: 'Disabled — remove staff access' },
              ]}
            />
            <p className="micro">
              Enabled allows this person to use their assigned staff role.
              Disabled removes staff workspace permissions; they can still sign
              in, and their account, devices, and history are kept. Operators
              manage their own devices. Administrators manage all devices and
              staff.
            </p>
            <Button type="submit" disabled={busy || !staffEmail.trim()}>
              Save staff access
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !staffEmail.trim() || staffActive !== 'true'}
              onClick={() =>
                void run(async () => {
                  if (
                    !document
                      .querySelector<HTMLInputElement>('#staff-email')
                      ?.reportValidity()
                  )
                    return;
                  const r = await requireSupabase().functions.invoke(
                    'staff-invite',
                    { body: { email: staffEmail.trim(), role: staffRole } },
                  );
                  if (r.error) {
                    const detail = await r.error.context
                      ?.json()
                      .catch(() => null);
                    throw Error(detail?.error || r.error.message);
                  }
                  setFeedback(r.data.message);
                })
              }
            >
              Send staff invitation
            </Button>
            {staffActive !== 'true' && (
              <p className="micro">
                Enable staff workspace access to send an invitation.
              </p>
            )}
          </form>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await requireSupabase().rpc('list_staff');
                if (r.error) throw r.error;
                setStaff(r.data);
              })
            }
          >
            Load staff directory
          </Button>
          {staff.map((s) => (
            <p key={s.email}>
              {s.email} · {s.role} · {s.active ? 'Enabled' : 'Disabled'}
            </p>
          ))}
        </section>
      )}
      <Button
        disabled={!devices.length}
        variant="outline"
        onClick={() => {
          const csv = (v: string | null) =>
            '"' +
            String(v ?? '')
              .replace(/^[=+@-]/, "'$&")
              .replaceAll('"', '""') +
            '"';
          download(
            'rutems-devices.csv',
            [
              [
                'id',
                'name',
                'deployment',
                'state',
                'last_contact',
                'sensor_model',
              ],
              ...devices.map((d) => [
                d.id,
                d.name,
                d.deployment,
                d.state,
                d.last_contact,
                d.sensor_model,
              ]),
            ]
              .map((row) => row.map(csv).join(','))
              .join('\r\n'),
          );
        }}
      >
        Export device inventory
      </Button>
    </div>
  );
}

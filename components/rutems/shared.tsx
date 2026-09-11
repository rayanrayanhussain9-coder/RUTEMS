'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { Context, useApp } from './state-context';
import { useAuth } from './auth';
export { useApp } from './state-context';
import { flushSync } from 'react-dom';
import { usePathname } from 'next/navigation';
import {
  Radar,
  ArrowUpRight,
  Bookmark,
  Menu,
  RefreshCw,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  type Snapshot,
  type Watch,
  type Notice,
  metrics,
  type Metric,
  evaluateWatch,
  fmtTime,
} from '@/lib/rutems/domain';
import { loadSnapshot } from '@/lib/rutems/data-access';
export { Button };
const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;
export function Choice({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Select an option',
}: {
  label: string;
  disabled?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientHydrated,
    serverHydrated,
  );
  return (
    <div className="choice">
      <span className="control-label">{label}</span>
      <Select
        value={value || null}
        onValueChange={(v) => v !== null && onChange(v)}
        items={options}
      >
        <SelectTrigger
          aria-label={label}
          disabled={disabled || !hydrated || !options.length}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export const metricOptions = Object.entries(metrics).map(([value, m]) => ({
  value,
  label: `${m.name}${m.unit ? ' · ' + m.unit : ''}`,
}));
export function MetricChoice({
  value,
  onChange,
}: {
  value: Metric;
  onChange: (m: Metric) => void;
}) {
  return (
    <Choice
      label="Measurement"
      value={value}
      onChange={(v) => onChange(v as Metric)}
      options={metricOptions}
    />
  );
}
export function Segments({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(String(v))}>
      <TabsList aria-label={label}>
        {options.map((o) => (
          <TabsTrigger key={o.value} value={o.value}>
            {o.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>
          <h2 className="empty-heading">{title}</h2>
        </EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function useStored<T>(
  key: string,
  fallback: T,
  validate: (v: unknown) => boolean = () => true,
) {
  const [value, setState] = useState(fallback),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState('');
  const current = useRef(fallback),
    initial = useRef(fallback),
    validator = useRef(validate);
  // Browser storage is an external system and must be read after server rendering.
  /* oxlint-disable react/react-compiler */
  useEffect(() => {
    try {
      const text = localStorage.getItem(key);
      if (text) {
        const parsed: unknown = JSON.parse(text);
        if (validator.current(parsed)) {
          current.current = parsed as T;
          setState(parsed as T);
        } else
          setError(
            'Some saved data could not be read. Reset it to start again.',
          );
      }
    } catch {
      setError(
        'Browser storage is unavailable. Changes will last for this visit only.',
      );
    }
    setLoaded(true);
  }, [key]);
  /* oxlint-enable react/react-compiler */
  const setValue = useCallback(
    (update: React.SetStateAction<T>) => {
      const next =
        typeof update === 'function'
          ? (update as (old: T) => T)(current.current)
          : update;
      current.current = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
        setError('');
      } catch {
        setError(
          'Browser storage is unavailable. Changes will last for this visit only.',
        );
      }
      setState(next);
    },
    [key],
  );
  return {
    value,
    setValue,
    loaded,
    error,
    reset: () => setValue(initial.current),
  };
}
const stringArray = (v: unknown) =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'demo' | 'real'>('real'),
    [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [message, setMessage] = useState('');
  const saved = useStored<string[]>('rutems-saved-real-v1', [], stringArray),
    comparison = useStored<string[]>('rutems-compare-real-v1', [], stringArray);
  const watches = useStored<Watch[]>(
    'rutems-watches-real-v1',
    [],
    (v) =>
      Array.isArray(v) &&
      v.every(
        (w) =>
          w &&
          typeof w.id === 'string' &&
          typeof w.locationId === 'string' &&
          w.metric in metrics &&
          Number.isFinite(w.threshold) &&
          [1, 24].includes(w.hours),
      ),
  );
  const notices = useStored<Notice[]>(
    'rutems-notices-real-v1',
    [],
    (v) =>
      Array.isArray(v) &&
      v.every(
        (n) =>
          n &&
          typeof n.id === 'string' &&
          typeof n.locationId === 'string' &&
          n.metric in metrics &&
          Number.isFinite(n.value) &&
          Number.isFinite(Date.parse(n.measuredAt)),
      ),
  );
  const { setValue: setSavedValue } = saved;
  const { setValue: setNoticeValue } = notices;
  const modeRef = useRef(mode);
  const activeRequest = useRef<AbortController | null>(null);
  const changeMode = useCallback((next: 'demo' | 'real') => {
    if (next === modeRef.current) return;
    activeRequest.current?.abort();
    modeRef.current = next;
    setData(null);
    setLoading(true);
    setError('');
    setMode(next);
  }, []);
  const refresh = useCallback(async () => {
    const selected = modeRef.current;
    activeRequest.current?.abort();
    const request = new AbortController();
    activeRequest.current = request;
    setRefreshing(true);
    try {
      const next = await loadSnapshot(
        selected,
        AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
      );
      if (!request.signal.aborted && selected === modeRef.current) {
        setData(next);
        setError('');
      }
    } catch (e) {
      if (!request.signal.aborted && selected === modeRef.current) {
        setData(null);
        setError(
          e instanceof Error ? e.message : 'Observation service unavailable',
        );
      }
    } finally {
      if (activeRequest.current === request) {
        activeRequest.current = null;
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);
  /* oxlint-disable react/react-compiler -- Synchronize view state when the external data source changes. */
  useEffect(() => {
    void refresh();
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const id = setInterval(refreshVisible, 30000);
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('online', refreshVisible);
    return () => {
      clearInterval(id);
      activeRequest.current?.abort();
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('online', refreshVisible);
    };
  }, [mode, refresh]);
  useEffect(() => {
    if (!data || data.mode !== 'real' || !watches.loaded || !notices.loaded)
      return;
    const incoming = watches.value.flatMap((w) => {
      const n = evaluateWatch(w, data).notice;
      return n ? [n] : [];
    });
    if (incoming.some((n) => !notices.value.some((o) => o.id === n.id)))
      setNoticeValue((old) => [
        ...incoming.filter((n) => !old.some((o) => o.id === n.id)),
        ...old,
      ]);
  }, [
    data,
    watches.value,
    watches.loaded,
    notices.loaded,
    notices.value,
    setNoticeValue,
  ]);
  /* oxlint-enable react/react-compiler */
  const toggleSave = useCallback(
    (id: string) =>
      setSavedValue((old) =>
        old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
      ),
    [setSavedValue],
  );
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'set_saved_places',
          description:
            'Save or unsave supported RUTEMS public locations on this browser.',
          inputSchema: {
            type: 'object',
            properties: {
              locationIds: { type: 'array', items: { type: 'string' } },
              saved: { type: 'boolean' },
            },
            required: ['locationIds', 'saved'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: unknown) => {
            const x = input as { locationIds: string[]; saved: boolean };
            if (
              !x ||
              !Array.isArray(x.locationIds) ||
              typeof x.saved !== 'boolean' ||
              !data ||
              x.locationIds.some(
                (id) => !data.locations.some((l) => l.id === id),
              )
            )
              throw Error('Use supported location IDs and a saved boolean');
            flushSync(() =>
              setSavedValue((old) =>
                x.saved
                  ? [...new Set([...old, ...x.locationIds])]
                  : old.filter((id) => !x.locationIds.includes(id)),
              ),
            );
            return { locationIds: x.locationIds, saved: x.saved };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, [data, setSavedValue]);
  return (
    <Context.Provider
      value={{
        data,
        loading,
        error,
        mode,
        setMode: changeMode,
        refresh,
        refreshing,
        saved: saved.value,
        toggleSave,
        resetSaved: saved.reset,
        comparison: comparison.value,
        setComparison: comparison.setValue,
        watches: watches.value,
        setWatches: watches.setValue,
        notices: notices.value,
        setNotices: setNoticeValue,
        storageError:
          saved.error || comparison.error || watches.error || notices.error,
        message,
        announce: setMessage,
      }}
    >
      {children}
      <output className="sr-only" aria-live="polite">
        {message}
      </output>
    </Context.Provider>
  );
}
const navItems = [
  ['/', 'Home'],
  ['/explore', 'Explore'],
  ['/compare', 'Compare'],
  ['/how-it-works', 'How It Works'],
  ['/methods', 'Data & Methods'],
];
export function Header() {
  const { user, role } = useAuth();
  const path = usePathname(),
    [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="RUTEMS home">
        <Radar size={32} />
        <span>
          RUTEMS<span className="brand-sub">OBSERVE YOUR ENVIRONMENT</span>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        {navItems.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={path === href ? 'active' : ''}
            aria-current={path === href ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Link className="operator-link" href={role ? '/operator' : '/login'}>
        {role ? 'Operator Workspace' : user ? 'Account' : 'Sign in'}{' '}
        <ArrowUpRight size={15} />
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="mobile-menu button"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </SheetTrigger>
        <SheetContent>
          <SheetTitle className="p-5">RUTEMS</SheetTitle>
          <SheetDescription className="px-5">
            Explore registered environmental observations.
          </SheetDescription>
          <div className="mobile-nav">
            {[
              ...navItems,
              ['/saved', 'Saved Places'],
              ['/operator', 'Operator Workspace'],
            ].map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                {label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer wrap">
      <div className="brand">
        <Radar size={24} />
        <span>RUTEMS</span>
      </div>
      <p>
        Local environmental insights.
        <br />
        <span className="micro">
          Coverage depends on reporting devices. Check freshness and quality.
        </span>
      </p>
      <div>
        <Link href="/methods">Data & Methods</Link>
        <Link href="/privacy">Privacy & attribution</Link>
        <Link href="/operator">Operator Workspace</Link>
      </div>
    </footer>
  );
}
export function DataBanner() {
  const { data, loading, refresh, refreshing } = useApp();
  return (
    <div className="data-banner">
      <div>
        <span className="badge">Device observations</span>
        <span>
          {!data
            ? 'Connecting to observation service…'
            : data.locations.length
              ? 'Published observation areas. Coverage is limited to reporting devices.'
              : 'No published observation areas yet.'}
        </span>
      </div>
      <div className="clock">
        <Button
          variant="outline"
          disabled={loading || refreshing}
          onClick={() => void refresh()}
          aria-label="Refresh observations"
        >
          <RefreshCw size={16} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
        <span>
          {data
            ? 'Checked ' + fmtTime(data.clock)
            : loading
              ? 'Connecting…'
              : 'Observations unavailable'}
        </span>
      </div>
    </div>
  );
}
export function DataGuard({ children }: { children: ReactNode }) {
  const { loading, error, refresh, storageError } = useApp();
  if (loading)
    return (
      <output className="load-state">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
        <p>Loading observations…</p>
      </output>
    );
  if (error)
    return (
      <div className="error-state" role="alert">
        <AlertTriangle />
        <h2>Observations unavailable</h2>
        <p>{error}</p>
        <Button onClick={() => void refresh()}>
          <RefreshCw /> Retry connection
        </Button>
        <Link href="/methods">Read about data modes</Link>
      </div>
    );
  return (
    <>
      {storageError && <p className="note warning">{storageError}</p>}
      {children}
    </>
  );
}
export function Note({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={'note' + (warning ? ' warning' : '')}>
      <Info size={17} />
      <div>{children}</div>
    </div>
  );
}
export function SavedLink() {
  const { saved } = useApp();
  return (
    <Link className="button" href="/saved">
      <Bookmark size={16} /> Saved Places{' '}
      <span className="count">{saved.length}</span>
    </Link>
  );
}

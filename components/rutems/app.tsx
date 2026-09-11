'use client';
import { Home, HowItWorks, Methods, Privacy } from './content';
import { Explore, Compare, LocationPage } from './explore';
import { Saved } from './saved';
import { Operator } from './operator';
import { EmptyState } from './shared';
import Link from 'next/link';
import { Login } from './auth';
export function RutemsApp({ route }: { route: string }) {
  if (route === 'login') return <Login />;
  if (route === 'home') return <Home />;
  if (route === 'explore') return <Explore />;
  if (route === 'compare') return <Compare />;
  if (route === 'saved') return <Saved />;
  if (route === 'operator') return <Operator />;
  if (route === 'how-it-works') return <HowItWorks />;
  if (route === 'methods') return <Methods />;
  if (route === 'privacy') return <Privacy />;
  if (route.startsWith('locations/'))
    return <LocationPage id={route.split('/')[1]} />;
  return (
    <EmptyState title="This page is not part of the pilot.">
      <Link href="/explore">Return to Explore</Link>
    </EmptyState>
  );
}

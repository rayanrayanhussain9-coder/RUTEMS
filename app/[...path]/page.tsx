import { RutemsApp } from '@/components/rutems/app';
export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  return <RutemsApp route={path.join('/')} />;
}

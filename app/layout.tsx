import type { Metadata } from 'next';
import { AppProvider, Header, Footer } from '@/components/rutems/shared';
import './globals.css';
import { AuthProvider } from '@/components/rutems/auth';
export const metadata: Metadata = {
  title: 'RUTEMS — Local environmental insights',
  description:
    'Environmental observations from registered city and trail devices, with transparent data quality and coverage.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <AuthProvider>
          <AppProvider>
            <Header />
            <main id="main">{children}</main>
            <Footer />
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

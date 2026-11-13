import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import { AppProvider } from '@/context/AppContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AppLayout from '@/components/layout/AppLayout';
import ServiceWorkerRegister from '@/components/pwa/ServiceWorkerRegister';
import QueryProvider from '@/lib/query/client';
import GlobalLoadingBar from '@/components/layout/GlobalLoadingBar';
import ThemeScript from '@/components/theme/ThemeScript';
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from '@/lib/brand';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1d21' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <body className="font-sans">
        <ThemeScript />
        <ServiceWorkerRegister />
        <QueryProvider>
          <GlobalLoadingBar />
          <ThemeProvider>
            <AppProvider>
              <AppLayout>{children}</AppLayout>
            </AppProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

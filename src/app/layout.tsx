import type { Metadata, Viewport } from 'next';
import './globals.css';
import { publicConfig } from '@/lib/config/env';

// IBM Plex Sans Arabic is self-hosted from /public/fonts (see globals.css);
// there is no Google Fonts dependency at build or run time.

export const metadata: Metadata = {
  metadataBase: new URL(publicConfig.appUrl),
  title: 'فان أور × الحزم',
  description: 'سجّل توقعك لكل مباراة من مباريات الحزم — منصة فان أور لتفاعل الجماهير.',
  applicationName: 'FanHour',
  openGraph: {
    title: 'فان أور × الحزم',
    description: 'سجّل توقعك لمباراة الحزم القادمة.',
    type: 'website',
    locale: 'ar_SA',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0E1A', // Midnight (Brand Manual §C6)
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* Preload the primary Arabic weight to avoid a flash of fallback text. */}
        <link
          rel="preload"
          href="/fonts/ibm-plex-arabic-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

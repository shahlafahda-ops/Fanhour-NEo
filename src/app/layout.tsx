import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { publicConfig } from '@/lib/config/env';

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

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
  themeColor: '#0A0A0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={arabic.variable}>
      <body>{children}</body>
    </html>
  );
}

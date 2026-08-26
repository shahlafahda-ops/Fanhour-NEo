import type { MetadataRoute } from 'next';

// FanHour PWA manifest (Brand Manual §C6 colours; approved mark as icon).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FanHour × الحزم',
    short_name: 'FanHour',
    description: 'سجّل توقعك لكل مباراة من مباريات الحزم.',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/app/alhazem',
    display: 'standalone',
    background_color: '#0A0E1A',
    theme_color: '#0A0E1A',
    icons: [
      { src: '/brand/fanhour-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}

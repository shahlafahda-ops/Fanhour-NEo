import { RIYADH_TZ } from '@/lib/domain/fixture';

/** Format an instant in Asia/Riyadh, Arabic locale (prompt §9). */
export function formatRiyadh(iso: string): string {
  return new Intl.DateTimeFormat('ar-SA', {
    timeZone: RIYADH_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatRiyadhDate(iso: string): string {
  return new Intl.DateTimeFormat('ar-SA', {
    timeZone: RIYADH_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

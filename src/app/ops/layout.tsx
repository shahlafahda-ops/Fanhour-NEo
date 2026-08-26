import Link from 'next/link';
import { LoginForm } from '@/components/LoginForm';
import { getOpsIdentity } from '@/lib/auth/guards';
import { hasSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/ops', label: 'لوحة القياس' },
  { href: '/ops/fixtures', label: 'المباريات' },
  { href: '/ops/campaigns', label: 'الحملات' },
  { href: '/ops/merchants', label: 'الشركاء' },
];

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabase()) {
    return (
      <div className="app-shell">
        <main className="flex-1 px-4 py-8 text-center text-content-secondary text-sm">
          Supabase غير مهيأ. راجع docs/OPERATIONS.md.
        </main>
      </div>
    );
  }

  const identity = await getOpsIdentity().catch(() => null);
  if (!identity) return <LoginForm title="FanHour Operations" portal="ops" />;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-surface-border px-4 py-3 flex items-center justify-between">
        <span className="font-bold">
          FanHour Ops <span className="text-content-muted text-xs">· {identity.role}</span>
        </span>
      </header>
      <nav className="flex gap-1 px-3 py-2 border-b border-surface-border overflow-x-auto">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-content-secondary hover:bg-surface-card2"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="max-w-3xl mx-auto px-4 py-5">{children}</div>
    </div>
  );
}

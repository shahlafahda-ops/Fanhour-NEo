import { BrandHeader, Card } from '@/components/ui';
import { LoginForm } from '@/components/LoginForm';
import { MerchantValidator } from '@/components/MerchantValidator';
import { getMerchantIdentity } from '@/lib/auth/guards';
import { hasSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function MerchantPage() {
  if (!hasSupabase()) return <NotConfigured />;

  const merchant = await getMerchantIdentity().catch(() => null);
  if (!merchant) return <LoginForm title="بوابة الشريك" portal="merchant" />;

  return <MerchantValidator displayName={merchant.displayName} />;
}

function NotConfigured() {
  return (
    <div className="app-shell">
      <BrandHeader />
      <main className="flex-1 px-4 py-8">
        <Card className="text-center text-content-secondary text-sm">
          Supabase غير مهيأ. راجع docs/OPERATIONS.md.
        </Card>
      </main>
    </div>
  );
}

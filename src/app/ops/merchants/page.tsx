import { getAdminClient } from '@/lib/supabase/admin';
import { requireOps } from '@/lib/auth/guards';
import { createMerchant, createMerchantUser, grantCampaignAccess } from '@/app/ops/merchantActions';

export const dynamic = 'force-dynamic';

export default async function OpsMerchantsPage() {
  await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();
  const [{ data: merchants }, { data: campaigns }, { data: staff }] = await Promise.all([
    supabase.from('merchant').select('id, name_ar, is_active').order('created_at', { ascending: false }),
    supabase.from('campaign').select('id, title_ar').order('created_at', { ascending: false }),
    supabase.from('merchant_user').select('id, display_name, merchant_id, is_active'),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-card bg-surface-card border border-surface-border p-4">
        <h2 className="font-semibold mb-3">إضافة شريك استلام</h2>
        <form action={createMerchant} className="grid gap-3">
          <input name="name" placeholder="اسم المتجر" required className="input" />
          <button className="rounded-card bg-brand-green text-surface-base font-bold py-3">حفظ</button>
        </form>
      </section>

      <section className="rounded-card bg-surface-card border border-surface-border p-4">
        <h2 className="font-semibold mb-3">حساب موظف استلام</h2>
        <form action={createMerchantUser} className="grid gap-3">
          <select name="merchantId" required className="input">
            <option value="">اختر المتجر</option>
            {(merchants ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name_ar}
              </option>
            ))}
          </select>
          <input name="displayName" placeholder="اسم الموظف" className="input" />
          <input name="email" type="email" dir="ltr" placeholder="Email" required className="input" />
          <input name="password" type="password" dir="ltr" placeholder="Password (8+)" required className="input" />
          <button className="rounded-card bg-surface-card2 border border-surface-border py-2.5 font-semibold">
            إنشاء الحساب
          </button>
        </form>
      </section>

      <section className="rounded-card bg-surface-card border border-surface-border p-4">
        <h2 className="font-semibold mb-3">منح وصول لحملة</h2>
        <form action={grantCampaignAccess} className="grid gap-3">
          <select name="merchantId" required className="input">
            <option value="">المتجر</option>
            {(merchants ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name_ar}
              </option>
            ))}
          </select>
          <select name="campaignId" required className="input">
            <option value="">الحملة</option>
            {(campaigns ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title_ar}
              </option>
            ))}
          </select>
          <button className="rounded-card bg-surface-card2 border border-surface-border py-2.5 font-semibold">
            منح الوصول
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">المتاجر</h2>
        {(merchants ?? []).map((m) => (
          <div key={m.id} className="rounded-card bg-surface-card border border-surface-border p-3 flex justify-between">
            <span>{m.name_ar}</span>
            <span className="text-xs text-content-muted">
              {(staff ?? []).filter((s) => s.merchant_id === m.id).length} موظف
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

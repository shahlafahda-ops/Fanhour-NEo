import { getAdminClient } from '@/lib/supabase/admin';
import { requireOps } from '@/lib/auth/guards';
import { createSponsor, createCampaign, setCampaignActive } from '@/app/ops/campaignActions';

export const dynamic = 'force-dynamic';

export default async function OpsCampaignsPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();
  const [{ data: sponsors }, { data: fixtures }, { data: campaigns }] = await Promise.all([
    supabase.from('sponsor').select('id, name_ar, commercial_type').order('created_at', { ascending: false }),
    supabase.from('fixture').select('id, opponent_ar, kickoff_at').order('kickoff_at', { ascending: false }).limit(20),
    supabase
      .from('campaign')
      .select('id, slug, title_ar, compliance_mode, is_active, issued_count, issue_cap, fixture_id, benefit_ar, terms_ar, expires_at')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      {searchParams?.error && (
        <div
          role="alert"
          className="rounded-card bg-state-danger/15 border border-state-danger text-state-danger p-3 text-sm"
        >
          {searchParams.error}
        </div>
      )}

      <section className="rounded-card bg-surface-card border border-surface-border p-4">
        <h2 className="font-semibold mb-3">إضافة شريك</h2>
        <form action={createSponsor} className="grid gap-3">
          <input name="name" placeholder="اسم الشريك" required className="input" />
          <select name="commercialType" className="input">
            <option value="paid">مدفوع</option>
            <option value="complimentary">تجريبي/مجاني</option>
            <option value="subsidized">مدعوم</option>
            <option value="merchant_only">شريك استلام فقط</option>
          </select>
          <input name="logoUrl" placeholder="رابط شعار الشريك (اختياري)" className="input" dir="ltr" />
          <button className="rounded-card bg-surface-card2 border border-surface-border py-2.5 font-semibold">
            حفظ الشريك
          </button>
        </form>
      </section>

      <section className="rounded-card bg-surface-card border border-surface-border p-4">
        <h2 className="font-semibold mb-3">إضافة حملة</h2>
        <form action={createCampaign} className="grid gap-3">
          <input name="title" placeholder="عنوان الحملة" required className="input" />
          <select name="sponsorId" required className="input">
            <option value="">اختر الشريك</option>
            {(sponsors ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar}
              </option>
            ))}
          </select>
          <select name="fixtureId" className="input">
            <option value="">اربط بمباراة (مطلوب للمنفعة)</option>
            {(fixtures ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                الحزم × {f.opponent_ar}
              </option>
            ))}
          </select>
          <input name="benefit" placeholder="المنفعة" className="input" />
          <input name="imageUrl" placeholder="رابط صورة الجائزة/المنفعة (اختياري)" className="input" dir="ltr" />
          <textarea name="terms" placeholder="الشروط" className="input" rows={2} />
          <select name="complianceMode" className="input">
            <option value="participation_benefit">منفعة مشاركة</option>
            <option value="engagement_only">تفاعل فقط</option>
          </select>
          <select name="revealTiming" className="input">
            <option value="post_result">بعد النتيجة</option>
            <option value="post_submission">بعد التوقع</option>
          </select>
          <input name="issueCap" type="number" min={0} placeholder="حد الإصدار" className="input" />
          <label className="text-sm text-content-secondary">
            انتهاء الصلاحية (الرياض)
            <input name="expires" type="datetime-local" className="input mt-1" />
          </label>
          <button className="rounded-card bg-brand-green text-surface-base font-bold py-3">
            حفظ الحملة (غير مفعّلة)
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">الحملات</h2>
        {(campaigns ?? []).map((c) => (
          <div key={c.id} className="rounded-card bg-surface-card border border-surface-border p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{c.title_ar}</div>
                <div className="text-xs text-content-muted">
                  {c.compliance_mode} · إصدار {c.issued_count}
                  {c.issue_cap ? `/${c.issue_cap}` : ''}
                </div>
              </div>
              <span
                className={`text-xs rounded-full px-2 py-1 ${
                  c.is_active ? 'bg-state-success/15 text-state-success' : 'bg-surface-card2'
                }`}
              >
                {c.is_active ? 'مفعّلة' : 'متوقفة'}
              </span>
            </div>
            <a
              href={`/ops/sponsor-report/${c.slug}`}
              className="text-brand-green text-xs underline"
            >
              تقرير قيمة الراعي
            </a>
            <form action={setCampaignActive}>
              <input type="hidden" name="campaignId" value={c.id} />
              <input type="hidden" name="activate" value={String(!c.is_active)} />
              <button className="rounded-card border border-surface-border px-4 py-2 text-sm">
                {c.is_active ? 'إيقاف' : 'تفعيل'}
              </button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}

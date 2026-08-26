import { getDashboardMetrics } from '@/lib/data/analytics';
import { requireOps } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-card bg-surface-card border border-surface-border p-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-content-secondary mt-1">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-content-secondary">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </section>
  );
}

export default async function OpsDashboard() {
  await requireOps(['super_admin', 'ops', 'analyst']);
  const m = await getDashboardMetrics();
  if (!m) return <p className="text-content-secondary">لا تتوفر بيانات.</p>;

  const dash = (n: number | null) => (n === null ? '—' : `${n}٪`);

  return (
    <div className="space-y-6">
      <Section title="التفعيل">
        <Metric label="مشاهدات المباريات" value={m.fixtureViews} />
        <Metric label="توقعات مكتملة" value={m.predictionsSubmitted} />
        <Metric label="نسبة الإكمال" value={dash(m.completionRatePct)} />
      </Section>

      <Section title="العودة (North Star: MRAF)">
        <Metric label="MRAF" value={m.mrafCount} />
        <Metric label="QMP‑1" value={m.qmp1} />
        <Metric label="QMP‑2" value={m.qmp2} />
        <Metric label="QMP‑4" value={m.qmp4} />
        <Metric label="QMP‑8" value={m.qmp8} />
      </Section>

      <Section title="التجاري">
        <Metric label="مشاهدات المنفعة" value={m.benefitViews} />
        <Metric label="تحقق OTP" value={m.otpVerified} />
        <Metric label="مزايا صادرة" value={m.benefitsIssued} />
        <Metric label="عمليات استلام" value={m.redemptionsValidated} />
        <Metric label="إصدار→استلام" value={dash(m.claimToRedemptionPct)} />
      </Section>

      <Section title="التنفيذ والدعم">
        <Metric label="محاولات فاشلة" value={m.redemptionFailed} />
        <Metric label="طلبات دعم" value={m.supportRequests} />
      </Section>
    </div>
  );
}

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
  const secs = (n: number | null) => (n === null ? '—' : `${n}s`);

  return (
    <div className="space-y-6">
      <Section title="الاكتساب والتفعيل">
        <Metric label="مشاهدات المباريات" value={m.fixtureViews} />
        <Metric label="توقعات مكتملة" value={m.predictionsSubmitted} />
        <Metric label="نسبة الإكمال" value={dash(m.completionRatePct)} />
        <Metric label="Activation 1 — أول توقع" value={m.activation1} />
        <Metric label="Activation 2 — أول نتيجة" value={m.activation2} />
        <Metric label="زمن أول توقع (وسيط)" value={secs(m.medianFirstPredictionSeconds)} />
      </Section>

      <Section title="العودة (North Star: MRAF)">
        <Metric label="MRAF" value={m.mrafCount} />
        <Metric label="QMP‑1" value={m.qmp1} />
        <Metric label="QMP‑2" value={m.qmp2} />
        <Metric label="QMP‑4" value={m.qmp4} />
        <Metric label="QMP‑8" value={m.qmp8} />
        <Metric label="F1 → F2" value={dash(m.f1ToF2Pct)} />
        <Metric label="F2 → F3" value={dash(m.f2ToF3Pct)} />
        <Metric label="F3 → F4" value={dash(m.f3ToF4Pct)} />
      </Section>

      <Section title="تجربة التذكيرات — Treatment مقابل Holdout (A1)">
        <Metric label="مشتركون في التذكيرات" value={m.reminderSubscribers} />
        <Metric
          label={`MRAF — Treatment (n=${m.reminderExperiment.treatment.n})`}
          value={dash(m.reminderExperiment.treatment.mrafRatePct)}
        />
        <Metric
          label={`MRAF — Holdout (n=${m.reminderExperiment.holdout.n})`}
          value={dash(m.reminderExperiment.holdout.mrafRatePct)}
        />
        {(m.reminderExperiment.treatment.sampleTooSmall ||
          m.reminderExperiment.holdout.sampleTooSmall) && (
          <p className="col-span-full text-xs text-state-warn">
            العينة صغيرة جدًا للاعتماد عليها إحصائيًا (أقل من 30 مشتركًا لكل مجموعة).
          </p>
        )}
      </Section>

      <Section title="نسبة الإكمال حسب مصدر الاكتساب (A2)">
        {m.completionBySource.length === 0 ? (
          <Metric label="لا بيانات بعد" value={0} />
        ) : (
          m.completionBySource.map((s) => (
            <Metric key={s.source} label={`${s.source} (${s.views} مشاهدة)`} value={dash(s.completionRatePct)} />
          ))
        )}
      </Section>

      <Section title="نقاط التوزيع لكل مباراة (مخطط/منفَّذ) (A2)">
        {m.touchpointsByFixture.length === 0 ? (
          <Metric label="لا مباريات" value={0} />
        ) : (
          m.touchpointsByFixture.map((t) => (
            <Metric
              key={t.fixtureId}
              label={t.zeroDelivered ? `⚠️ ${t.opponentAr} — لا توزيع مُنفَّذ` : t.opponentAr}
              value={`${t.delivered}/${t.planned}`}
            />
          ))
        )}
      </Section>

      <Section title="المستوى والتفاعل">
        <Metric label="متوسط النقاط" value={m.averageXp ?? '—'} />
        <Metric label="نتائج مضبوطة" value={m.exactScoreSuccesses} />
        {m.rankDistribution.map((r) => (
          <Metric key={r.nameAr} label={r.nameAr} value={r.count} />
        ))}
      </Section>

      <Section title="السلاسل ودورة حياة المشجع">
        {m.streakDistribution.length === 0 ? (
          <Metric label="سلاسل نشطة" value={0} />
        ) : (
          m.streakDistribution.map((sd) => (
            <Metric key={sd.depth} label={`سلسلة ${sd.depth}`} value={sd.count} />
          ))
        )}
        {/* Internal Ops vocabulary — never shown to supporters. */}
        <Metric label="ACTIVATED" value={m.lifecycle.ACTIVATED} />
        <Metric label="ENGAGED" value={m.lifecycle.ENGAGED} />
        <Metric label="POWER FAN" value={m.lifecycle.POWER_FAN} />
        <Metric label="AT RISK" value={m.lifecycle.AT_RISK} />
      </Section>

      <Section title="تفاعلات التعليق (تشخيصية)">
        {m.commentaryCounts.length === 0 ? (
          <Metric label="لم تُعرض بعد" value={0} />
        ) : (
          m.commentaryCounts.map((c) => (
            <Metric key={c.reactionKey} label={c.phraseAr} value={c.count} />
          ))
        )}
      </Section>

      {/* A3 — the honest commercial funnel: eligible population is the
          denominator for claim rate, not the total audience. */}
      <Section title="القمع التجاري — وصلنا ← شاركوا ← المؤهلون ← طالبوا ← استلموا">
        <Metric label="وصلنا" value={m.reachedCount} />
        <Metric label="شاركوا" value={m.participatedCount} />
        <Metric label="المؤهلون للمنفعة" value={m.eligiblePopulation} />
        <Metric label="طالبوا بالمنفعة" value={m.benefitsIssued} />
        <Metric label="استلموا فعليًا" value={m.redemptionsValidated} />
        <Metric label="نسبة الطلب من المؤهلين" value={dash(m.claimRateOfEligiblePct)} />
        <Metric label="مشاهدات المنفعة" value={m.benefitViews} />
        <Metric label="تحقق OTP" value={m.otpVerified} />
        <Metric label="إصدار→استلام" value={dash(m.claimToRedemptionPct)} />
      </Section>

      {m.benefitBlockedByReason.length > 0 && (
        <Section title="أسباب حجب المنفعة (تشخيصي — ليس ضعف اهتمام بالضرورة)">
          {m.benefitBlockedByReason.map((r) => (
            <Metric key={r.reason} label={r.reason} value={r.count} />
          ))}
        </Section>
      )}

      <Section title="التنفيذ والدعم">
        <Metric label="محاولات فاشلة" value={m.redemptionFailed} />
        <Metric label="طلبات دعم" value={m.supportRequests} />
      </Section>

      <Section title="متوسط وقت التنفيذ لكل مباراة — دقائق (A5)">
        <Metric label="إعداد الأسئلة" value={m.avgMinutesPerFixture.questionSet ?? '—'} />
        <Metric label="التحقق" value={m.avgMinutesPerFixture.verification ?? '—'} />
        <Metric label="الحسم" value={m.avgMinutesPerFixture.resolution ?? '—'} />
        <Metric label="تقرير الراعي" value={m.avgMinutesPerFixture.sponsorReporting ?? '—'} />
      </Section>
    </div>
  );
}

import { getAdminClient } from '@/lib/supabase/admin';
import { requireOps } from '@/lib/auth/guards';
import { createFixture, resolveFixture } from '@/app/ops/actions';
import { formatRiyadh } from '@/lib/i18n/format';

export const dynamic = 'force-dynamic';

interface FixtureListRow {
  id: string;
  opponent_ar: string;
  competition_ar: string;
  kickoff_at: string;
  status: string;
  hazem_score: number | null;
  opponent_score: number | null;
  is_test: boolean;
}

export default async function OpsFixturesPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  await requireOps(['super_admin', 'ops']);
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('fixture')
    .select('id, opponent_ar, competition_ar, kickoff_at, status, hazem_score, opponent_score, is_test')
    .order('kickoff_at', { ascending: false })
    .limit(50);
  const fixtures = (data as FixtureListRow[]) ?? [];

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
        <h2 className="font-semibold mb-3">إضافة مباراة</h2>
        <form action={createFixture} className="grid grid-cols-1 gap-3">
          <input name="opponent" placeholder="الخصم" required className="input" />
          <input name="competition" placeholder="البطولة" required className="input" />
          <select name="hazemSide" className="input">
            <option value="home">الحزم على أرضه</option>
            <option value="away">الحزم خارج أرضه</option>
          </select>
          <label className="text-sm text-content-secondary">
            موعد المباراة (توقيت الرياض)
            <input name="kickoff" type="datetime-local" required className="input mt-1" />
          </label>
          <label className="text-xs text-content-muted flex items-center gap-2">
            <input name="isTest" type="checkbox" /> مباراة تجريبية
          </label>
          <button className="rounded-card bg-brand-green text-surface-base font-bold py-3">
            حفظ
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">المباريات</h2>
        {fixtures.map((f) => (
          <div key={f.id} className="rounded-card bg-surface-card border border-surface-border p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">
                  الحزم × {f.opponent_ar}
                  {f.is_test && <span className="text-state-warn text-xs mr-2">تجريبي</span>}
                </div>
                <div className="text-xs text-content-muted">
                  {f.competition_ar} · {formatRiyadh(f.kickoff_at)}
                </div>
              </div>
              <span className="text-xs rounded-full bg-surface-card2 px-2 py-1">{f.status}</span>
            </div>

            {f.status === 'resolved' ? (
              <div className="text-sm text-content-secondary">
                النتيجة: {f.hazem_score} – {f.opponent_score}
              </div>
            ) : (
              <form action={resolveFixture} className="flex items-end gap-2">
                <input type="hidden" name="fixtureId" value={f.id} />
                <label className="text-xs">
                  الحزم
                  <input name="hazemScore" type="number" min={0} required className="input w-16 mt-1" />
                </label>
                <label className="text-xs">
                  {f.opponent_ar}
                  <input name="opponentScore" type="number" min={0} required className="input w-16 mt-1" />
                </label>
                <button className="rounded-card bg-surface-card2 border border-surface-border px-4 py-2 text-sm">
                  إنهاء وحسم
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

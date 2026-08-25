import { BrandHeader, Card } from '@/components/ui';

/**
 * Legal content is NOT invented here. Until approved Arabic copy is supplied,
 * pages render a visible REQUIRES_APPROVED_LEGAL_COPY blocker (prompt §54, §56)
 * — this is a production launch blocker tracked in docs/LAUNCH_CHECKLIST.md.
 */
export function LegalPage({
  title,
  version,
  approvedHtml,
}: {
  title: string;
  version: string;
  approvedHtml?: string;
}) {
  return (
    <div className="app-shell">
      <BrandHeader />
      <main className="flex-1 px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        {approvedHtml ? (
          <article
            className="prose prose-invert text-content-secondary text-sm leading-7"
            dangerouslySetInnerHTML={{ __html: approvedHtml }}
          />
        ) : (
          <Card className="space-y-2 border-state-warn/40">
            <div className="text-state-warn font-semibold">REQUIRES_APPROVED_LEGAL_COPY</div>
            <p className="text-sm text-content-secondary">
              لم تُضَف بعد النسخة القانونية المعتمدة لهذه الصفحة. هذا عنصر مانع للإطلاق.
            </p>
          </Card>
        )}
        <p className="text-xs text-content-muted">النسخة: {version}</p>
      </main>
    </div>
  );
}

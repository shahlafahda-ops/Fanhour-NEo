import { BrandHeader, Card } from '@/components/ui';
import { FixtureExperience } from '@/components/FixtureExperience';
import { getActiveFixture } from '@/lib/data/fixtures';
import { AR } from '@/lib/i18n/ar';

// Landing directly in the active fixture context (prompt §7) — no marketing home.
export const dynamic = 'force-dynamic';

export default async function AlHazemPage() {
  const fixture = await getActiveFixture();
  if (!fixture) return <NoActiveFixture />;
  return <FixtureExperience fixture={fixture} />;
}

function NoActiveFixture() {
  return (
    <div className="app-shell">
      <BrandHeader />
      <main className="flex-1 px-4 py-8 flex items-center">
        <Card className="w-full text-center space-y-2">
          <h1 className="text-lg font-bold">{AR.fixture.noActiveFixture}</h1>
          <p className="text-content-secondary text-sm">{AR.fixture.noActiveFixtureBody}</p>
        </Card>
      </main>
    </div>
  );
}

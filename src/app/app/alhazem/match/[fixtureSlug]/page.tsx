import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FixtureExperience } from '@/components/FixtureExperience';
import { getFixtureBySlug } from '@/lib/data/fixtures';
import { AR } from '@/lib/i18n/ar';

export const dynamic = 'force-dynamic';

// Rich share previews for social acquisition (prompt §47).
export async function generateMetadata({
  params,
}: {
  params: { fixtureSlug: string };
}): Promise<Metadata> {
  const fixture = await getFixtureBySlug(params.fixtureSlug);
  if (!fixture) return { title: 'فان أور × الحزم' };
  const title = `${AR.fixture.hazem} × ${fixture.opponentAr} — فان أور`;
  const description = `${fixture.competitionAr} · ${AR.fixture.predictCta}`;
  return {
    title,
    description,
    openGraph: { title, description, locale: 'ar_SA', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function MatchPage({ params }: { params: { fixtureSlug: string } }) {
  const fixture = await getFixtureBySlug(params.fixtureSlug);
  if (!fixture) notFound();
  return <FixtureExperience fixture={fixture} />;
}

import { AR } from './ar';
import type { CommentaryReaction } from '@/lib/domain/commentary';

/**
 * Map a reaction's i18n key + data to its Arabic supporting sentence.
 * Rule 9: the supporting line must always explain WHY the phrase appeared, so
 * a reaction with no resolvable copy is rendered without a phrase at all.
 */
export function commentarySupportingText(reaction: CommentaryReaction): string | null {
  const d = reaction.data ?? {};
  switch (reaction.supportingCopyKey) {
    case 'commentary.belMillimeter':
      return typeof d.predicted === 'string' && typeof d.actual === 'string'
        ? AR.commentary.belMillimeter(d.predicted, d.actual)
        : null;
    case 'commentary.yaRabaahRare':
      return typeof d.sharePct === 'number' ? AR.commentary.yaRabaahRare(d.sharePct) : null;
    case 'commentary.yaRabaahCorrect':
      return typeof d.sharePct === 'number' ? AR.commentary.yaRabaahCorrect(d.sharePct) : null;
    case 'commentary.ayniAyniRank':
      return typeof d.rank === 'string' ? AR.commentary.ayniAyniRank(d.rank) : null;
    case 'commentary.ayniAyniRun':
      return typeof d.correct === 'number' && typeof d.window === 'number'
        ? AR.commentary.ayniAyniRun(d.correct, d.window)
        : null;
    default:
      return null;
  }
}

import { commentarySupportingText } from '@/lib/i18n/commentary';
import type { CommentaryReaction } from '@/lib/domain/commentary';

/**
 * Transient football-commentary microcopy. Deliberately restrained: no confetti,
 * no flashing, no casino celebration — a commentator reacting, not a slot machine.
 * Renders nothing unless the supporting sentence explains why it appeared.
 */
export function CommentaryBanner({ reaction }: { reaction: CommentaryReaction | null }) {
  if (!reaction) return null;
  const supporting = commentarySupportingText(reaction);
  if (!supporting) return null;

  return (
    <div
      role="status"
      className="rounded-card border border-brand-green/35 bg-brand-greenDim px-4 py-3 text-center motion-safe:animate-[fadeIn_.35s_ease-out]"
    >
      <p className="text-brand-green font-bold text-lg leading-snug">{reaction.phraseAr}</p>
      <p className="text-content-secondary text-sm mt-1">{supporting}</p>
    </div>
  );
}

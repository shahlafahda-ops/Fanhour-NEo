import { AR } from './ar';
import { REMINDER_TEMPLATES, validateTemplateParams, type CadenceSlot } from '@/lib/domain/reminder';

/**
 * Render a cadence slot's templated, parameterised message. Returns null if
 * a required parameter is missing — there is no free-text fallback, ever.
 */
export function renderReminderMessage(
  slot: CadenceSlot,
  params: Readonly<Record<string, string>>,
): string | null {
  const template = REMINDER_TEMPLATES[slot];
  if (validateTemplateParams(template, params) !== true) return null;

  switch (slot) {
    case 't_minus_48h':
      return AR.reminderMessages.t48h(params.opponentAr!, params.kickoffLabel!);
    case 't_minus_2h':
      return AR.reminderMessages.t2h(params.opponentAr!);
    case 'resolution':
      return AR.reminderMessages.resolution(params.opponentAr!);
    default:
      return null;
  }
}

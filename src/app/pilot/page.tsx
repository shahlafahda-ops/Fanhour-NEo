import { redirect } from 'next/navigation';

// Clean alias for the canonical Al Hazem experience (prompt §6).
export default function PilotAlias() {
  redirect('/app/alhazem');
}

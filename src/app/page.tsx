import { redirect } from 'next/navigation';

// Root goes straight to the pilot experience — no generic marketing homepage.
export default function Home() {
  redirect('/app/alhazem');
}

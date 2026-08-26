import { LegalPage } from '@/components/LegalPage';
import { serverConfig } from '@/lib/config/env.server';

export default function TermsPage() {
  return <LegalPage title="شروط الاستخدام" version={serverConfig.termsVersion} />;
}

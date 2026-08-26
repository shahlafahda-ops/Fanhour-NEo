import { LegalPage } from '@/components/LegalPage';
import { serverConfig } from '@/lib/config/env.server';

export default function PrivacyPage() {
  return <LegalPage title="سياسة الخصوصية" version={serverConfig.privacyPolicyVersion} />;
}

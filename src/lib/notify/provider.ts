import 'server-only';
import { isProduction } from '@/lib/config/env';
import { serverConfig } from '@/lib/config/env.server';

/**
 * Notification provider abstraction, mirroring `src/lib/otp/provider.ts`.
 * Adapters are selected by NOTIFY_PROVIDER. The `mock` provider is permitted
 * ONLY outside production; the factory hard-fails if it is selected in
 * production — exactly as OTP does.
 *
 * NOTE: real providers below are integration stubs — they define the
 * contract and where credentials plug in. They must be completed with the
 * contracted Saudi messaging provider before real sends go out (see
 * docs/LAUNCH_CHECKLIST.md).
 */

export interface SendResult {
  ok: boolean;
  providerRef?: string;
  error?: string;
}

export interface NotifyProvider {
  readonly name: string;
  /** Deliver a templated message to an E.164 number. No free text — the
   * caller has already rendered the message from an approved template. */
  send(e164: string, message: string): Promise<SendResult>;
}

/** Dev-only provider. Never delivers a real message; never used in production. */
class MockNotifyProvider implements NotifyProvider {
  readonly name = 'mock';
  async send(e164: string, message: string): Promise<SendResult> {
    // eslint-disable-next-line no-console
    console.info(`[notify:mock] would send to ${e164} (dev only): ${message}`);
    return { ok: true, providerRef: 'mock' };
  }
}

class UnifonicNotifyProvider implements NotifyProvider {
  readonly name = 'unifonic';
  async send(e164: string, message: string): Promise<SendResult> {
    if (!process.env.UNIFONIC_APP_SID) {
      return { ok: false, error: 'unifonic_not_configured' };
    }
    void e164;
    void message;
    return { ok: false, error: 'unifonic_adapter_not_implemented' };
  }
}

class WhatsAppNotifyProvider implements NotifyProvider {
  readonly name = 'whatsapp';
  async send(e164: string, message: string): Promise<SendResult> {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      return { ok: false, error: 'whatsapp_not_configured' };
    }
    void e164;
    void message;
    return { ok: false, error: 'whatsapp_adapter_not_implemented' };
  }
}

let cached: NotifyProvider | null = null;

export function getNotifyProvider(): NotifyProvider {
  if (cached) return cached;
  const selected = serverConfig.notifyProvider;

  if (selected === 'mock') {
    if (isProduction) {
      // Hard fail — a mock notification provider must never run in production.
      throw new Error('FATAL: NOTIFY_PROVIDER=mock is not allowed in production.');
    }
    cached = new MockNotifyProvider();
  } else if (selected === 'unifonic') {
    cached = new UnifonicNotifyProvider();
  } else if (selected === 'whatsapp') {
    cached = new WhatsAppNotifyProvider();
  } else {
    throw new Error(`Unknown NOTIFY_PROVIDER: ${selected}`);
  }
  return cached;
}

/*
 * SMS/OTP transport.
 *
 * Appendix B8 classifies OTP/SMS as BUY, not BUILD, and the pre-launch gate
 * requires an operational route through a licensed provider (CST regulates SMS
 * providers; OTP is treated as transactional, never marketing).
 *
 * No real provider is wired up here. `MockSmsProvider` is a development stub
 * that records messages in memory so the flow can be exercised end to end.
 * A production provider must be implemented against this same interface and
 * reviewed under PDPL before Day 0.
 */

export class MockSmsProvider {
  constructor() {
    this.sent = [];
    this.name = 'mock';
  }

  async sendOtp(e164, code) {
    this.sent.push({ to: e164, code, at: new Date().toISOString() });
    if (process.env.FH_LOG_OTP === '1') {
      console.log(`[sms:mock] OTP ${code} -> ${e164}`);
    }
    return { ok: true, providerRef: `mock-${this.sent.length}` };
  }

  /** Test/support helper. Never expose over an unauthenticated route. */
  lastFor(e164) {
    return [...this.sent].reverse().find((m) => m.to === e164) || null;
  }

  /** Clear recorded messages — used when resetting a demo run. */
  clear() {
    this.sent = [];
  }
}

let provider = new MockSmsProvider();

export const getSmsProvider = () => provider;
export const setSmsProvider = (p) => { provider = p; };

/** Guard used by the launch-readiness check: the pilot may not go public on a stub. */
export const isProductionSmsConfigured = () => provider.name !== 'mock';

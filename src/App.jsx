import FanApp from './fan/FanApp.jsx';
import MerchantApp from './merchant/MerchantApp.jsx';

/*
 * Two separate surfaces on one deployment:
 *   /          the Arabic-first fan challenge
 *   /merchant  the outlet staff validator
 *
 * Path-based rather than a router dependency — the pilot has exactly two
 * entry points and the spec favours a light, fast page over added weight.
 */
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/merchant') return <MerchantApp />;
  return <FanApp />;
}

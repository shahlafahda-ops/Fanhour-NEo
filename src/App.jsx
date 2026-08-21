import FanApp from './fan/FanApp.jsx';
import MerchantApp from './merchant/MerchantApp.jsx';
import BoardApp from './board/BoardApp.jsx';

/*
 * Three separate surfaces on one deployment:
 *   /          the Arabic-first fan challenge
 *   /merchant  the outlet staff validator
 *   /board     the FanHour-operated live value board (projector)
 *
 * Path-based rather than a router dependency — the pilot has a handful of
 * entry points and the spec favours a light, fast page over added weight.
 */
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/merchant') return <MerchantApp />;
  if (path === '/board') return <BoardApp />;
  return <FanApp />;
}

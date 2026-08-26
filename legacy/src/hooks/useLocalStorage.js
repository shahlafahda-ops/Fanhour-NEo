import { useState, useEffect } from 'react';

/**
 * Drop-in replacement for useState that persists to localStorage.
 * Usage: const [xp, setXp] = useLocalStorage('fh-xp', 3240);
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn('localStorage write failed:', error);
    }
  };

  return [storedValue, setValue];
}

/**
 * Persist any object to localStorage, merged with defaults.
 */
export function usePersistedState(key, defaults) {
  const [state, setState] = useLocalStorage(key, defaults);

  const update = (partial) =>
    setState((prev) => ({ ...prev, ...(typeof partial === 'function' ? partial(prev) : partial) }));

  return [state, update];
}

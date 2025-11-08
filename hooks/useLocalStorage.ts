import { useState, useEffect, Dispatch, SetStateAction } from 'react';

export function useLocalStorage<T,>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      // If item doesn't exist or was incorrectly stored as "undefined", use initial value.
      if (item === null || item === 'undefined') {
        return initialValue;
      }
      return JSON.parse(item);
    } catch (error) {
      // If parsing fails, the data is corrupt. Log it, remove it, and fall back.
      console.error(`Error parsing localStorage key "${key}":`, error);
      window.localStorage.removeItem(key); // This makes the hook self-healing.
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      // Prevent storing `undefined`, which gets stringified to "undefined".
      if (storedValue === undefined) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

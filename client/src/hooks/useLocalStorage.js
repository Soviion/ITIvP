import { useEffect, useState } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/storage';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Значение из localStorage подходит, только если тип совпадает с начальным значением
function readInitial(key, initialValue) {
  const stored = loadFromStorage(key, initialValue);
  if (isPlainObject(initialValue) && isPlainObject(stored)) return { ...initialValue, ...stored };
  if (typeof stored !== typeof initialValue || Array.isArray(stored) !== Array.isArray(initialValue)) return initialValue;
  return stored;
}

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => readInitial(key, initialValue));

  useEffect(() => {
    saveToStorage(key, value);
  }, [key, value]);

  return [value, setValue];
}

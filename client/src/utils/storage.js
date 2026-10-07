// Безопасная работа с localStorage: данные хранятся как JSON-строки.

export function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback; // ключа нет — первый запуск
    return JSON.parse(raw); // JSON.parse превращает строку обратно в объект/массив
  } catch {
    return fallback; // повреждённый JSON или недоступное хранилище
  }
}

export function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value)); // JSON.stringify: объект/массив -> строка
    return true;
  } catch {
    return false; // переполнение квоты или приватный режим
  }
}

export function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // хранилище недоступно — удалять нечего
  }
}

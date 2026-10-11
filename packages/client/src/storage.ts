// Local storage may not work, for example in private mode or when site data is blocked. When a read fails, we act as if nothing was saved.

export interface StoredValue<T> {
  read(): T | null;
  write(value: T): void;
  clear(): void;
}

/** `parse` reads the text that was saved, and `format` makes it. A value that is not text, like a flag, needs its own `format`. */
export function storedValue<T>(
  key: string,
  parse: (raw: string | null) => T | null,
  format: (value: T) => string = String,
): StoredValue<T> {
  return {
    read: () => {
      try {
        return parse(localStorage.getItem(key));
      } catch {
        return null;
      }
    },
    write: (value) => {
      try {
        localStorage.setItem(key, format(value));
      } catch {
        // The save failed, so the value lives only until the page is closed.
      }
    },
    clear: () => {
      try {
        localStorage.removeItem(key);
      } catch {
        // When storage is blocked, the write failed too, so there is nothing saved to remove.
      }
    },
  };
}

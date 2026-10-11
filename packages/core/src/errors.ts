export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The `code` of a Firebase error, such as "auth/invalid-email". An empty string when the error has none. */
export function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
}

/**
 * Serializes an arbitrary thrown value into something safe and useful to log.
 *
 * Adapters receive `error` as `unknown`, so it may be an `Error`, a plain
 * object, a primitive, or something with a hostile `toString`. Calling
 * `String(value)` directly is unsafe (it can throw) and lossy (objects become
 * `"[object Object]"`). This helper branches on the value's shape instead:
 *
 *   - `Error`        → `{ name, message, stack?, cause? }`
 *   - primitive/null → the value coerced with `String()` (always safe)
 *   - object         → a JSON-cloned copy, preserving its fields
 *   - anything else  → `Object.prototype.toString` (cannot be hijacked)
 */
export function serializeError(
  error: unknown,
): Record<string, unknown> | string {
  if (error instanceof Error) {
    // `cause` is only typed on Error from es2022 onward; read it defensively so
    // the helper works regardless of the configured lib target.
    const cause = (error as { cause?: unknown }).cause;
    return {
      name: error.name,
      message: error.message,
      ...(error.stack && { stack: error.stack }),
      ...(cause !== undefined && { cause: serializeError(cause) }),
    };
  }

  if (error === null || typeof error !== 'object') {
    return String(error);
  }

  try {
    return JSON.parse(JSON.stringify(error)) as Record<string, unknown>;
  } catch {
    return Object.prototype.toString.call(error);
  }
}

/**
 * String form of {@link serializeError}, for adapters (e.g. Nest) that embed
 * the error into a single log message rather than a structured field.
 */
export function serializeErrorToString(error: unknown): string {
  const serialized = serializeError(error);
  return typeof serialized === 'string'
    ? serialized
    : JSON.stringify(serialized);
}

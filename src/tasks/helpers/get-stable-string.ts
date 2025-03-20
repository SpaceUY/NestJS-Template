/**
 * Creates a stable string representation of a payload object
 * by sorting object keys to ensure consistent output.
 * This is necessary for the caching strategy; changes in the JSON payload order cannot causing the caching
 * to fail.
 */
export function getStableStringFromPayload(payload: any): string {
  if (typeof payload !== "object" || payload === null) {
    return String(payload);
  }

  // For arrays, map each item to a stable string and join
  if (Array.isArray(payload)) {
    return (
      `[${
        payload.map(item => getStableStringFromPayload(item)).join(",")
      }]`
    );
  }

  // For objects, sort keys and build a stable string
  const sortedKeys = Object.keys(payload).sort();
  const parts = sortedKeys.map((key) => {
    const value = getStableStringFromPayload(payload[key]);
    return `"${key}":${value}`;
  });

  return `{${parts.join(",")}}`;
}

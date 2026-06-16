export function reloadableSourceToken(sourceName: string): string {
  return `RELOADABLE_CONFIG_SOURCE_${sourceName.toUpperCase()}`;
}

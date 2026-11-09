export function assetUrl(name) {
  return globalThis.__AURA_EMBEDDED_ASSETS__?.[name] ?? `${import.meta.env.BASE_URL}assets/${name}`;
}

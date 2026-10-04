export type IdentityRegistry = Record<string, string>;
function validate(registry: IdentityRegistry): void {
  const ids = Object.values(registry);
  if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length)
    throw new Error('Identity registry collision or empty ID');
}
export function assignIdentity(key: string, registry: IdentityRegistry): string {
  validate(registry);
  const id = Object.hasOwn(registry, key) ? registry[key] : undefined;
  if (!id) throw new Error(`Unallocated source identity: ${key}`);
  return id;
}
export function allocateIdentity(
  key: string,
  id: string,
  registry: IdentityRegistry,
): IdentityRegistry {
  validate(registry);
  if (!key.trim() || !id.trim()) throw new Error('Empty source identity');
  if (Object.hasOwn(registry, key) && registry[key] !== id)
    throw new Error(`Identity collision for ${key}`);
  if (Object.entries(registry).some(([other, assigned]) => other !== key && assigned === id))
    throw new Error(`Identity collision for ${id}`);
  return { ...registry, [key]: id };
}

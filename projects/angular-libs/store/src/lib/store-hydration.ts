const hydrating = new WeakSet<object>();

export function beginStoreHydration(store: object): void {
  hydrating.add(store);
}

export function endStoreHydration(store: object): void {
  hydrating.delete(store);
}

export function isStoreHydrating(store: object): boolean {
  return hydrating.has(store);
}

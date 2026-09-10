import type { ControlPlaneStore } from "./types.ts";
import { MemoryControlPlaneStore } from "./memory.ts";
import { PostgresControlPlaneStore } from "./postgres.ts";

let singleton: ControlPlaneStore | undefined;

export function createControlPlaneStore(): ControlPlaneStore {
  if (process.env.DATABASE_URL) return new PostgresControlPlaneStore(process.env.DATABASE_URL);
  return new MemoryControlPlaneStore();
}

export function getControlPlaneStore(): ControlPlaneStore {
  singleton ??= createControlPlaneStore();
  return singleton;
}

export function resetControlPlaneStoreForTests() {
  singleton = undefined;
}

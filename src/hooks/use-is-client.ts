"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `true` після гідрації, `false` на сервері.
 * Через useSyncExternalStore, а не setState в ефекті — без зайвого ререндера.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

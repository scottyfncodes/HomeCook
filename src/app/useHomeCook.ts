/**
 * The single source of truth for the UI: one record, loaded from localStorage
 * on start and written back on every change.
 */
import { useSyncExternalStore } from 'react';
import type { HomeCookData } from '@homecook/core/types';
import { Store } from '@homecook/core/store';
import { load, save } from '@homecook/core/persist';

export const store = new Store<HomeCookData>(load());

store.subscribe(() => {
  save(store.get());
});

/** Apply a pure action from `core/actions`. */
export function apply(fn: (data: HomeCookData) => HomeCookData): void {
  store.update(fn);
}

export function useHomeCook(): HomeCookData {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.get(),
    () => store.get(),
  );
}

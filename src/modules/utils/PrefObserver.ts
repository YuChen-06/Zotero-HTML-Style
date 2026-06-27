/*
 * Copyright (C) 2026 YuChen
 *
 * This file is part of Zotero Theme Switcher.
 *
 * Zotero Theme Switcher is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Zotero Theme Switcher is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Zotero Theme Switcher.  If not, see <https://www.gnu.org/licenses/>.
 */

import { disposeFn, type Disposable } from "./Disposable";

export type PrefChangeListener = (fullPrefKey: string) => void;

// ponytail: Zotero 7 (firefox115) always has Zotero.Prefs.registerObserver.
type ZoteroPrefsAPI = {
  registerObserver: (
    prefBranchOrPrefix: string,
    callback: (fullKey: string) => void,
    global?: boolean,
  ) => unknown;
  unregisterObserver?: (
    prefBranchOrPrefix: string,
    callback: (fullKey: string) => void,
    global?: boolean,
  ) => unknown;
};

/** Register a pref observer for a prefix. Returns a Disposable to unregister. */
export function observePrefPrefix(
  prefix: string,
  listener: PrefChangeListener,
): Disposable {
  const z = Zotero as unknown as { Prefs: ZoteroPrefsAPI };
  z.Prefs.registerObserver(prefix, listener, true);

  if (typeof z.Prefs.unregisterObserver === "function") {
    return disposeFn(() => {
      try {
        z.Prefs.unregisterObserver!(prefix, listener, true);
      } catch {
        /* best-effort */
      }
    });
  }

  return disposeFn(() => {});
}

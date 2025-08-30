import pkg from "../../package.json";

const PREFS_PREFIX = pkg.config.prefsPrefix;

export function getPref(key: string) {
  return Zotero.Prefs.get(`${PREFS_PREFIX}.${String(key)}`, true) as any;
}

export function setPref(key: string, value: any) {
  return Zotero.Prefs.set(`${PREFS_PREFIX}.${String(key)}`, value, true);
}

export function clearPref(key: string) {
  return Zotero.Prefs.clear(`${PREFS_PREFIX}.${String(key)}`, true);
}

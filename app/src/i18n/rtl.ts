// Direction is authoritative for rendering (master plan §8, §13).
const RTL_LANGS = new Set(["ar", "fa", "ur", "ps", "he", "ckb", "sd", "ug"]);

export function isRTL(langCode: string | null | undefined): boolean {
  if (!langCode) return false;
  return RTL_LANGS.has(langCode.split("-")[0].toLowerCase());
}

export function dirFor(langCode: string | null | undefined): "rtl" | "ltr" {
  return isRTL(langCode) ? "rtl" : "ltr";
}

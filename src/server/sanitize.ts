/**
 * HITO 2.4 - Saneo compartido del motor (lo usa el servidor thin; la Go
 * vuelve a sanear al pintar). Elimina ANSI/OSC/C1, controles C0 (salvo
 * \n y \t), controles bidireccionales de spoofing y trunca a 2000.
 * NOTA: este fichero es ASCII puro; las secuencias usan escapes \x y \u.
 */
const ESC = "\x1b";
const OSC = new RegExp(ESC + "\\][^\\x07\\\\]*(?:\\x07|" + ESC + "\\\\)", "g");
const CSI = new RegExp(ESC + "\\[[0-9;?]*[a-zA-Z]", "g");
const BIDI = new RegExp("[\\u202A-\\u202E\\u2066-\\u2069\\u200E\\u200F\\u061C]", "g");
const C0 = new RegExp("[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]", "g");

export function sanitizeThinOut(s: string): string {
  return String(s).replace(OSC, "").replace(CSI, "").replace(BIDI, "").replace(C0, "").slice(0, 2000);
}

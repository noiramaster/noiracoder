/* HITO 2.4 - corpus de saneo del motor. Falla si algo malicioso pasa. */
import { sanitizeThinOut } from "../dist/server/sanitize.js";

const cases = [
  ["clear", "[2J[Hhola", "hola"],
  ["colores", "[32m[y][0m sí", "[y] sí"],
  ["osc8-link", "]8;;http://evil\\click]8;;\\", "click"],
  ["titulo", "]0;pwnedX", "X"],
  ["cpr", "[6n", ""],
  ["c0", "ab\nc\td", "ab\nc\td"],
  ["del", "ab", "ab"],
  ["bidi", "a‮evil", "aevil"],
  ["normal-es-ar", "hola cañón مرحبا", "hola cañón مرحبا"],
];
let fails = 0;
for (const [name, input, want] of cases) {
  const got = sanitizeThinOut(input);
  const ok = got === want;
  if (!ok) fails++;
  console.log((ok ? "[PASS]" : "[FAIL]") + " " + name + (ok ? "" : ` got=${JSON.stringify(got)} want=${JSON.stringify(want)}`));
}
const long = sanitizeThinOut("x".repeat(3000));
const okLong = long.length === 2000;
if (!okLong) fails++;
console.log((okLong ? "[PASS]" : "[FAIL]") + " truncado-2000 (len=" + long.length + ")");
if (fails) {
  console.log(`SANITIZE: ${fails} FALLOS`);
  process.exit(1);
}
console.log("SANITIZE: todo el corpus pasa");

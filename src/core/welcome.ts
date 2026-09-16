/**
 * Pantalla de bienvenida con arte ASCII usando el símbolo ">" en dorado
 * (#FBBF24 = marca NoiraCode). Solo el logo/welcome usa el dorado; el resto
 * de la interfaz usa colores estándar de terminal.
 */
import { color } from "./logger.js";

export function welcomeArt(version: string): string {
  const line = (n: number): string => {
    const art: Record<number, string> = {
      1: ">>  >       >> >       >> >     >",
      2: ">   >       >   >      >   >   > ",
      3: ">>  >       >> >       >    > >  ",
      4: ">   >       >   >      >     >   ",
      5: ">   > > > > >>  >       >     >   ",
    };
    return art[n] ?? ">".repeat(28);
  };

  const gold = (s: string): string => color.gold(s);
  const out: string[] = [];
  for (let i = 1; i <= 5; i++) out.push(gold(line(i)));
  out.push("");
  out.push(gold(color.bold("> NOIRACODER")) + color.dim(`  v${version}`));
  out.push(color.dim("> Tu senior 24/7, gratis. Símbolo >> = marca Noira #FBBF24."));
  out.push("");
  return out.join("\n");
}

export function printWelcome(version: string): void {
  const text = welcomeArt(version);
  // Only color when stdout is a TTY; the helper already handles that.
  process.stdout.write(text + "\n");
}
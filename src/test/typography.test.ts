import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regra de tipografia do site: só DOIS formatos.
 *  1) Títulos: Playfair Display (500; 700 só nos preços em destaque dos banners).
 *  2) Todo o resto: Inter (400, 500, 600).
 * Nenhuma outra família pode aparecer no código.
 */
const ROOT = join(__dirname, "..");
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(name)) files.push(p);
  }
};
walk(ROOT);

const FORBIDDEN = /font-mono|font-serif|\bGeorgia\b|\bArial\b|Helvetica|Times New Roman|Courier|monospace|Cormorant|Manrope|Roboto|Poppins|Montserrat|Lato|Open Sans|Nunito/;

describe("tipografia: só Playfair Display e Inter", () => {
  it("não usa nenhuma outra família de fonte", () => {
    const bad = files
      .filter((f) => !f.endsWith("typography.test.ts") && !f.endsWith("styles.css"))
      .filter((f) => FORBIDDEN.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(ROOT, "src"));
    expect(bad).toEqual([]);
  });
  it("carrega apenas Playfair Display e Inter no Google Fonts", () => {
    const root = readFileSync(join(ROOT, "routes/__root.tsx"), "utf8");
    const families = [...root.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1]);
    expect(families.sort()).toEqual(["Inter", "Playfair+Display"]);
  });
  it("as variáveis de fonte do CSS são só as duas", () => {
    const css = readFileSync(join(ROOT, "styles.css"), "utf8");
    expect(css).toMatch(/--font-heading:\s*"Playfair Display"/);
    expect(css).toMatch(/--font-body:\s*"Inter"/);
  });
});

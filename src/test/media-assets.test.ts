import { closeSync, openSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("depoimentos em vídeo — orçamento de entrega", () => {
  it("mantém o depoimento longo abaixo de 7 MB sem remover o arquivo público", () => {
    const file = join(process.cwd(), "public", "depoimentos", "depoimento-3.mp4");
    expect(statSync(file).size).toBeLessThan(7_000_000);
    const header = Buffer.alloc(12);
    const handle = openSync(file, "r");
    try {
      expect(readSync(handle, header, 0, header.length, 0)).toBe(header.length);
    } finally {
      closeSync(handle);
    }
    expect(header.toString("ascii", 4, 8)).toBe("ftyp");
  });
});

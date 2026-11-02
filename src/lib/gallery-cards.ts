export type GalleryCard = { id: string; title: string; lines: string[] };

const clean = (s: string) => s.replace(/\*\*/g, "").replace(/^[-•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();

/** Divide a descrição do catálogo em seções (título em negrito + linhas). */
function sections(description: string) {
  const out = new Map<string, string[]>();
  for (const block of description.split(/\n---\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const head = lines[0]?.match(/^\*\*([^*]+)\*\*$/);
    if (head) out.set(head[1]!.trim().toUpperCase(), lines.slice(1).map(clean).filter(Boolean));
  }
  return out;
}

/** Lâminas extras da galeria, montadas só com o texto que já existe no catálogo do produto. */
export function buildCards(p: { short: string; description: string }): GalleryCard[] {
  const s = sections(p.description);
  const cards: GalleryCard[] = [];
  const result = s.get("AÇÃO / RESULTADO");
  cards.push({ id: "resultado", title: "Resultado", lines: (result?.length ? result : [p.short]).slice(0, 4) });
  const inside = s.get("O QUE VEM NO COMBO") ?? s.get("ATIVOS E FUNÇÃO");
  if (inside?.length) cards.push({ id: "conteudo", title: s.has("O QUE VEM NO COMBO") ? "O que vem no combo" : "Ativos e função", lines: inside.slice(0, 4) });
  const use = s.get("COMO USAR") ?? s.get("APRESENTAÇÃO");
  if (use?.length) cards.push({ id: "uso", title: s.has("COMO USAR") ? "Como usar" : "Apresentação", lines: use.slice(0, 4) });
  cards.push({ id: "compra", title: "Compra segura", lines: ["Frete grátis acima de R$ 150", "Até 6x sem juros no cartão", "5% de desconto no Pix", "7 dias para desistir da compra"] });
  return cards;
}

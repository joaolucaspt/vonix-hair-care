/**
 * Black Friday 2026. Datas reais (horário de Brasília): o esquenta vai até a véspera e a oferta tem data final verdadeira.
 * Nada aqui muda preço: só diz em que fase o site está e guarda a lista de produtos-foco.
 */
export const BF_START = new Date("2026-11-27T00:00:00-03:00");
/** Ainda a confirmar com o dono da loja. */
export const BF_END = new Date("2026-11-30T23:59:59-03:00");

export type BfPhase = "esquenta" | "ativa" | "encerrada";

export const bfPhase = (now: Date = new Date()): BfPhase =>
  now < BF_START ? "esquenta" : now <= BF_END ? "ativa" : "encerrada";

/** A página e o aviso do esquenta só existem antes da Black Friday abrir. */
export const bfEsquentaAberto = (now: Date = new Date()) => bfPhase(now) === "esquenta";

/** Dias inteiros que faltam para abrir (0 no dia). */
export const bfDiasParaAbrir = (now: Date = new Date()) =>
  Math.max(0, Math.ceil((BF_START.getTime() - now.getTime()) / 864e5));

export const BF_DATA_ABERTURA = "27/11";

/** Produtos-foco da Black Friday: Botox, Fio de Luz e kits (Monovonix fica de fora: margem menor). */
export const BF_FOCO: { titulo: string; texto: string; slug: string }[] = [
  { titulo: "Botox Vonix", texto: "Controle de volume e frizz, com maciez e brilho.", slug: "botox-vonix" },
  { titulo: "Progressiva Fio de Luz", texto: "Alinhamento profissional para o salão.", slug: "progressiva-fio-de-luz" },
  { titulo: "Kits", texto: "Cronograma completo em um só pedido.", slug: "kit-cronograma-capilar" },
];

/**
 * Desconto da Black Friday por produto (só vale com a oferta ativa, nunca no esquenta nem depois do prazo):
 * kits 20% (menos o Monovonix, margem menor), Botox 30% (sobra mais de R$ 60 por unidade no cartão), Progressiva Fio de Luz 15%.
 * Não soma com o "leve 2 / leve 3": vale o maior dos dois, para proteger a margem.
 */
export const bfPct = (slug: string | undefined, now: Date = new Date()): number => {
  if (!slug || bfPhase(now) !== "ativa") return 0;
  if (slug === "kit-monovonix") return 0;
  if (slug.startsWith("kit-")) return 20;
  if (slug.startsWith("botox-")) return 30;
  if (slug === "progressiva-fio-de-luz") return 15;
  return 0;
};

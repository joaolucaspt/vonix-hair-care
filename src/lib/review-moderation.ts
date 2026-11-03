/**
 * Conferência automática das avaliações enviadas pelo site. A avaliação que passa aparece na hora;
 * a que levanta suspeita fica "pendente" (não aparece) até o dono liberar no banco.
 */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Palavrões e ofensas comuns. Palavra inteira, sem acento. */
const BAD_WORDS = [
  "porra", "caralho", "merda", "puta", "putaria", "fdp", "foda", "fodase", "foda-se", "cu", "buceta", "arrombado", "viado",
  "otario", "otaria", "idiota", "imbecil", "lixo", "golpe", "golpista", "ladrao", "ladroes", "estelionato", "vagabundo", "vagabunda",
];

export type Veredito = { status: "aprovada" | "pendente"; motivo?: string };

export function moderate(nome: string, comentario: string): Veredito {
  const texto = norm(`${nome} ${comentario}`);
  if (/(https?:|www\.|\.com\b|\.br\b|\.net\b|bit\.ly|wa\.me|t\.me|@[a-z0-9_.]{3,})/.test(texto)) return { status: "pendente", motivo: "link ou contato no texto" };
  if (/\d[\d\s().-]{7,}\d/.test(texto)) return { status: "pendente", motivo: "número de telefone ou documento no texto" };
  if (/(.)\1{7,}/.test(texto)) return { status: "pendente", motivo: "letras repetidas demais" };
  const palavras = texto.split(/[^a-z0-9-]+/).filter(Boolean);
  if (palavras.some((p) => BAD_WORDS.includes(p))) return { status: "pendente", motivo: "palavra ofensiva" };
  if (/\b(ganhe|ganhar)\s+dinheiro\b|\brenda\s+extra\b|\bclique\s+aqui\b/.test(texto)) return { status: "pendente", motivo: "cara de propaganda" };
  return { status: "aprovada" };
}

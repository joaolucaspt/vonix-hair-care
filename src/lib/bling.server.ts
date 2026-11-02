import { env, requireEnv } from "./env.server";
import type { AppmaxOrder } from "./appmax.server";

/**
 * Bling API v3 (ERP): cria o pedido de venda quando o pagamento é confirmado na Appmax.
 * Desligado até as chaves existirem (BLING_CLIENT_ID, BLING_CLIENT_SECRET e BLING_REFRESH_TOKEN).
 * O refresh token do Bling muda a cada renovação; aqui o mais novo fica só em memória.
 * Para produção estável, guarde o novo token num banco (pendência no docs/ESTRUTURA.md).
 */
const AUTH = "https://www.bling.com.br/Api/v3/oauth/token";
const API = "https://api.bling.com.br/Api/v3";

export const blingEnabled = () => Boolean(env("BLING_CLIENT_ID") && env("BLING_CLIENT_SECRET") && env("BLING_REFRESH_TOKEN"));

let cached: { token: string; expiresAt: number } | null = null;
let refreshToken = "";

async function getToken(force = false) {
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${requireEnv("BLING_CLIENT_ID")}:${requireEnv("BLING_CLIENT_SECRET")}`).toString("base64");
  const res = await fetch(AUTH, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "1.0" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken || requireEnv("BLING_REFRESH_TOKEN") }),
  });
  if (!res.ok) throw new Error(`Bling auth ${res.status}`);
  const j = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  refreshToken = j.refresh_token;
  cached = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function bling<T>(method: "GET" | "POST", path: string, body?: unknown, retried = false): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await getToken(retried)}`, Accept: "application/json", "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401 && !retried) return bling<T>(method, path, body, true);
  const text = await res.text();
  if (!res.ok) throw new Error(`Bling ${method} ${path} ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as T;
}

/** Campos que o pedido da Appmax costuma trazer; a estrutura exata será confirmada com a chave de teste. */
type Loose = {
  customer?: { first_name?: string; last_name?: string; email?: string; phone?: string; document_number?: string; address?: { street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string; postcode?: string } };
  products?: { sku?: string; name?: string; quantity?: number; unit_value?: number }[];
  shipping_value?: number;
  discount_value?: number;
};

/** Envia a venda paga ao Bling. Usa o número do pedido Appmax como numeroLoja para não duplicar. */
export async function sendPaidOrder(order: AppmaxOrder) {
  if (!blingEnabled()) return "bling desligado";
  const o = order.data.order as AppmaxOrder["data"]["order"] & Loose;
  const c = o.customer;
  if (!c || !o.products?.length) return "pedido da Appmax sem cliente ou itens: mapeamento a confirmar";
  const a = c.address ?? {};
  await bling("POST", "/pedidos/vendas", {
    numeroLoja: String(o.id),
    ...(env("BLING_LOJA_ID") ? { loja: { id: Number(env("BLING_LOJA_ID")) } } : {}),
    observacoes: "Origem: site Vonix Hair (vonixhaircosmeticos.com.br) | Pedido Appmax " + o.id,
    data: new Date().toISOString().slice(0, 10),
    contato: { nome: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), tipoPessoa: "F", numeroDocumento: c.document_number, email: c.email, celular: c.phone },
    itens: o.products.map((p) => ({ codigo: p.sku, descricao: p.name, unidade: "UN", quantidade: p.quantity, valor: p.unit_value })),
    desconto: { valor: o.discount_value ?? 0, unidade: "REAL" },
    transporte: {
      fretePorConta: 0,
      frete: o.shipping_value ?? 0,
      etiqueta: { nome: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), endereco: a.street, numero: a.number, complemento: a.complement, bairro: a.district, municipio: a.city, uf: a.state, cep: a.postcode },
    },
  });
  return "enviado";
}

export type PainelOrder = { id: number; numero: number; data: string; total: number; cliente: string; situacao: string; canal: string };

/** Nome do canal a partir do nome da loja cadastrada no Bling (Shopee, TikTok Shop, Magalu, site...). */
function canalDe(nome: string, id: number | undefined) {
  if (/shopee/i.test(nome)) return "Shopee";
  if (/tiktok/i.test(nome)) return "TikTok Shop";
  if (/magalu|magazine/i.test(nome)) return "Magalu";
  if (/mercado\s*livre/i.test(nome)) return "Mercado Livre";
  if (id && String(id) === env("BLING_LOJA_ID")) return "Site Vonix";
  if (/site|vonix|e-?commerce|loja virtual/i.test(nome)) return "Site Vonix";
  return nome || (id ? `Loja ${id}` : "Sem loja");
}

/** Pedidos de venda dos últimos `days` dias, de todas as lojas ligadas ao Bling, com o canal de cada um. */
export async function listOrders(days: number): Promise<PainelOrder[]> {
  const nomes = new Map<number, string>();
  try {
    const l = await bling<{ data?: { id: number; descricao?: string; nome?: string }[] }>("GET", "/lojas");
    for (const x of l.data ?? []) nomes.set(x.id, x.descricao ?? x.nome ?? "");
  } catch (e) {
    console.error("[bling] lojas", e);
  }
  const fim = new Date();
  const ini = new Date(fim.getTime() - days * 86_400_000);
  const dia = (d: Date) => d.toISOString().slice(0, 10);
  const out: PainelOrder[] = [];
  for (let pagina = 1; pagina <= 5; pagina++) {
    const r = await bling<{ data?: { id: number; numero: number; data: string; total: number; contato?: { nome?: string }; situacao?: { valor?: number }; loja?: { id?: number } }[] }>(
      "GET",
      `/pedidos/vendas?pagina=${pagina}&limite=100&dataInicial=${dia(ini)}&dataFinal=${dia(fim)}`,
    );
    const rows = r.data ?? [];
    for (const p of rows) {
      out.push({ id: p.id, numero: p.numero, data: p.data, total: p.total, cliente: p.contato?.nome ?? "", situacao: String(p.situacao?.valor ?? ""), canal: canalDe(nomes.get(p.loja?.id ?? 0) ?? "", p.loja?.id) });
    }
    if (rows.length < 100) break;
  }
  return out;
}

export type PedidoDetalhe = {
  cliente: string; documento: string; email: string; telefone: string;
  endereco: string; frete: number; desconto: number; observacoes: string;
  itens: { descricao: string; quantidade: number; valor: number; custo: number }[];
  custoTotal: number; lucro: number;
};

const custos = new Map<number, number>();
/** Preço de custo (o que a Vonix paga) do produto no cadastro do Bling; 0 quando não está cadastrado. */
async function custoDoProduto(id: number | undefined) {
  if (!id) return 0;
  const hit = custos.get(id);
  if (hit !== undefined) return hit;
  let custo = 0;
  try {
    const r = await bling<{ data?: { precoCusto?: number; fornecedor?: { precoCusto?: number; precoCompra?: number } } }>("GET", `/produtos/${id}`);
    custo = r.data?.fornecedor?.precoCusto || r.data?.precoCusto || r.data?.fornecedor?.precoCompra || 0;
  } catch (e) {
    console.error("[bling] produto", e);
  }
  custos.set(id, custo);
  return custo;
}

/** Detalhe de um pedido: dados do cliente (telefone, e-mail, CPF), endereço de entrega e itens. */
export async function getOrderDetail(id: number): Promise<PedidoDetalhe> {
  type Addr = { endereco?: string; numero?: string; complemento?: string; bairro?: string; cep?: string; municipio?: string; uf?: string };
  const p = (await bling<{
    data: {
      contato?: { id?: number; nome?: string; numeroDocumento?: string };
      itens?: { descricao?: string; quantidade?: number; valor?: number; produto?: { id?: number } }[];
      transporte?: { frete?: number; etiqueta?: Addr & { nome?: string } };
      desconto?: { valor?: number };
      observacoes?: string;
    };
  }>("GET", `/pedidos/vendas/${id}`)).data;
  let c: { email?: string; telefone?: string; celular?: string; endereco?: { geral?: Addr } } = {};
  if (p.contato?.id) {
    try {
      c = (await bling<{ data: typeof c }>("GET", `/contatos/${p.contato.id}`)).data;
    } catch (e) {
      console.error("[bling] contato", e);
    }
  }
  const a: Addr = p.transporte?.etiqueta?.endereco ? p.transporte.etiqueta : (c.endereco?.geral ?? {});
  const endereco = [a.endereco && `${a.endereco}${a.numero ? ", " + a.numero : ""}`, a.complemento, a.bairro, [a.municipio, a.uf].filter(Boolean).join(" - "), a.cep && `CEP ${a.cep}`].filter(Boolean).join(" · ");
  const itens = [];
  for (const i of p.itens ?? []) itens.push({ descricao: i.descricao ?? "", quantidade: i.quantidade ?? 0, valor: i.valor ?? 0, custo: await custoDoProduto(i.produto?.id) });
  const custoTotal = itens.reduce((s, i) => s + i.custo * i.quantidade, 0);
  const vendido = itens.reduce((s, i) => s + i.valor * i.quantidade, 0) - (p.desconto?.valor ?? 0);
  return {
    cliente: p.contato?.nome ?? "",
    documento: p.contato?.numeroDocumento ?? "",
    email: c.email ?? "",
    telefone: c.celular || c.telefone || "",
    endereco,
    frete: p.transporte?.frete ?? 0,
    desconto: p.desconto?.valor ?? 0,
    observacoes: p.observacoes ?? "",
    itens,
    custoTotal,
    lucro: vendido - custoTotal,
  };
}

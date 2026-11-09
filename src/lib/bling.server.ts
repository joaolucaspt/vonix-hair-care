import { env, requireEnv } from "./env.server";
import { orderSnapshotSchema, type OrderSnapshot } from "./order-snapshot.server";
import { readBlingRefreshToken, rotateBlingRefreshToken } from "./bling-refresh.server";

/**
 * Bling API v3 (ERP): cria o pedido de venda quando o pagamento é confirmado na Appmax.
 * Desligado até as chaves existirem (BLING_CLIENT_ID, BLING_CLIENT_SECRET e BLING_REFRESH_TOKEN).
 * O refresh token do Bling muda a cada renovação; aqui o mais novo fica só em memória.
 * Para produção estável, guarde o novo token num banco (pendência no docs/ESTRUTURA.md).
 */
const AUTH = "https://api.bling.com.br/Api/v3/oauth/token";
const API = "https://api.bling.com.br/Api/v3";

export const blingEnabled = () =>
  Boolean(
    env("BLING_CLIENT_ID") &&
    env("BLING_CLIENT_SECRET") &&
    env("SUPABASE_URL") &&
    env("SUPABASE_SERVICE_ROLE_KEY"),
  );

let cached: { token: string; expiresAt: number } | null = null;
// Rotating refresh credentials are persisted in Supabase, never only in worker memory.

async function getToken(force = false) {
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(
    `${requireEnv("BLING_CLIENT_ID")}:${requireEnv("BLING_CLIENT_SECRET")}`,
  ).toString("base64");
  const currentRefreshToken = await readBlingRefreshToken();
  const res = await fetch(AUTH, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "1.0",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: currentRefreshToken }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Bling auth ${res.status}`);
  const j = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  await rotateBlingRefreshToken(currentRefreshToken, j.refresh_token);
  cached = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function bling<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  retried = false,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getToken(retried)}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401 && !retried) return bling<T>(method, path, body, true);
  const text = await res.text();
  if (!res.ok) throw new Error(`Bling ${method} HTTP ${res.status}`);
  return JSON.parse(text) as T;
}

/** Appmax monetary values are integer cents; Bling sale values are BRL decimals. */
export function appmaxCentsToBrl(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Valor da Appmax em centavos inválido");
  return value / 100;
}

/**
 * Export the immutable server-priced checkout snapshot. GET /v1/orders/{id}
 * only provides the payment state, totals and a minimal customer object.
 * It DOES NOT include the product lines and shipping address required by Bling.
 */
export async function sendPaidOrder(snapshot: OrderSnapshot) {
  if (!blingEnabled()) throw new Error("Bling não configurado");
  const data = orderSnapshotSchema.parse(snapshot);
  const id = data.orderId;
  // Guard against duplicate exports after retry or an unknown POST response.
  const existing = await bling<{ data: { numeroLoja?: string | number }[] }>(
    "GET",
    `/pedidos/vendas?numerosLojas%5B%5D=${encodeURIComponent(String(id))}`,
  );
  if (!Array.isArray(existing.data)) throw new Error("Consulta de duplicidade Bling inválida");
  // If Bling omits numeroLoja in this endpoint, we cannot establish that a
  // previous request failed: stop rather than risk shipping a duplicate.
  if (existing.data.some((entry) => entry.numeroLoja == null))
    throw new Error("Bling não retornou a referência de loja para deduplicação");
  if (existing.data.some((entry) => String(entry.numeroLoja) === String(id))) return "ja enviado";
  // This GET is explicitly filtered by store number. If the provider returns
  // unrelated orders, we cannot trust the filter and must not risk a duplicate.
  if (existing.data.length > 0)
    throw new Error("Consulta Bling retornou pedidos de outra referência de loja");
  const c = data.customer;
  const a = data.address;
  const created = await bling<{ data?: { id?: unknown } }>("POST", "/pedidos/vendas", {
    numeroLoja: String(id),
    ...(env("BLING_LOJA_ID") ? { loja: { id: Number(env("BLING_LOJA_ID")) } } : {}),
    observacoes: "Origem: site Vonix Hair (vonixhair.com) | Pedido Appmax " + id,
    data: new Date().toISOString().slice(0, 10),
    contato: {
      nome: c.name,
      tipoPessoa: "F",
      numeroDocumento: c.documentNumber,
      email: c.email,
      celular: c.phone,
    },
    itens: data.products.map((p) => ({
      codigo: p.sku,
      descricao: p.name,
      unidade: "UN",
      quantidade: p.quantity,
      valor: appmaxCentsToBrl(p.unitValueCents),
    })),
    desconto: { valor: appmaxCentsToBrl(data.discountValueCents), unidade: "REAL" },
    transporte: {
      fretePorConta: 0,
      frete: appmaxCentsToBrl(data.shippingValueCents),
      etiqueta: {
        nome: c.name,
        endereco: a.street,
        numero: a.number,
        complemento: a.complement,
        bairro: a.district,
        municipio: a.city,
        uf: a.state,
        cep: a.postcode,
      },
    },
  });
  if (
    typeof created?.data?.id !== "number" ||
    !Number.isSafeInteger(created.data.id) ||
    created.data.id <= 0
  )
    throw new Error("Bling não confirmou o ID do pedido criado");
  return "enviado";
}

export type PainelOrder = {
  id: number;
  numero: number;
  data: string;
  total: number;
  cliente: string;
  situacao: string;
  canal: string;
};

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
    const l = await bling<{ data?: { id: number; descricao?: string; nome?: string }[] }>(
      "GET",
      "/lojas",
    );
    for (const x of l.data ?? []) nomes.set(x.id, x.descricao ?? x.nome ?? "");
  } catch (e) {
    console.error("[bling] lojas", e);
  }
  const fim = new Date();
  const ini = new Date(fim.getTime() - days * 86_400_000);
  const dia = (d: Date) => d.toISOString().slice(0, 10);
  const out: PainelOrder[] = [];
  for (let pagina = 1; pagina <= 5; pagina++) {
    const r = await bling<{
      data?: {
        id: number;
        numero: number;
        data: string;
        total: number;
        contato?: { nome?: string };
        situacao?: { valor?: number };
        loja?: { id?: number };
      }[];
    }>(
      "GET",
      `/pedidos/vendas?pagina=${pagina}&limite=100&dataInicial=${dia(ini)}&dataFinal=${dia(fim)}`,
    );
    const rows = r.data ?? [];
    for (const p of rows) {
      out.push({
        id: p.id,
        numero: p.numero,
        data: p.data,
        total: p.total,
        cliente: p.contato?.nome ?? "",
        situacao: String(p.situacao?.valor ?? ""),
        canal: canalDe(nomes.get(p.loja?.id ?? 0) ?? "", p.loja?.id),
      });
    }
    if (rows.length < 100) break;
  }
  return out;
}

export type PedidoDetalhe = {
  cliente: string;
  documento: string;
  email: string;
  telefone: string;
  endereco: string;
  frete: number;
  desconto: number;
  observacoes: string;
  itens: { descricao: string; quantidade: number; valor: number; custo: number }[];
  custoTotal: number;
  lucro: number;
};

const custos = new Map<number, number>();
/** Preço de custo (o que a Vonix paga) do produto no cadastro do Bling; 0 quando não está cadastrado. */
async function custoDoProduto(id: number | undefined) {
  if (!id) return 0;
  const hit = custos.get(id);
  if (hit !== undefined) return hit;
  let custo = 0;
  try {
    const r = await bling<{
      data?: { precoCusto?: number; fornecedor?: { precoCusto?: number; precoCompra?: number } };
    }>("GET", `/produtos/${id}`);
    custo =
      r.data?.fornecedor?.precoCusto || r.data?.precoCusto || r.data?.fornecedor?.precoCompra || 0;
  } catch (e) {
    console.error("[bling] produto", e);
  }
  custos.set(id, custo);
  return custo;
}

/** Detalhe de um pedido: dados do cliente (telefone, e-mail, CPF), endereço de entrega e itens. */
export async function getOrderDetail(id: number): Promise<PedidoDetalhe> {
  type Addr = {
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cep?: string;
    municipio?: string;
    uf?: string;
  };
  const p = (
    await bling<{
      data: {
        contato?: { id?: number; nome?: string; numeroDocumento?: string };
        itens?: {
          descricao?: string;
          quantidade?: number;
          valor?: number;
          produto?: { id?: number };
        }[];
        transporte?: { frete?: number; etiqueta?: Addr & { nome?: string } };
        desconto?: { valor?: number };
        observacoes?: string;
      };
    }>("GET", `/pedidos/vendas/${id}`)
  ).data;
  let c: { email?: string; telefone?: string; celular?: string; endereco?: { geral?: Addr } } = {};
  if (p.contato?.id) {
    try {
      c = (await bling<{ data: typeof c }>("GET", `/contatos/${p.contato.id}`)).data;
    } catch (e) {
      console.error("[bling] contato", e);
    }
  }
  const a: Addr = p.transporte?.etiqueta?.endereco
    ? p.transporte.etiqueta
    : (c.endereco?.geral ?? {});
  const endereco = [
    a.endereco && `${a.endereco}${a.numero ? ", " + a.numero : ""}`,
    a.complemento,
    a.bairro,
    [a.municipio, a.uf].filter(Boolean).join(" - "),
    a.cep && `CEP ${a.cep}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const itens = [];
  for (const i of p.itens ?? [])
    itens.push({
      descricao: i.descricao ?? "",
      quantidade: i.quantidade ?? 0,
      valor: i.valor ?? 0,
      custo: await custoDoProduto(i.produto?.id),
    });
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

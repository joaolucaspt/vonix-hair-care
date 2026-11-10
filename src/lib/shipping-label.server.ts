import { env } from "./env.server";
import { calculateShipping, melhorEnvio, packageSize } from "./melhorenvio.server";
import {
  buildCartBody,
  hasOrderTag,
  parsePaidOrder,
  pickService,
  type PaidOrder,
  type Sender,
} from "./shipping-label";

/**
 * Etiqueta automática: quando o Appmax avisa "Pedido pago", cria o envio no Melhor Envio,
 * compra com o saldo e gera a etiqueta, que fica pronta para imprimir em Envios > Liberados.
 *
 * - Nunca duplica: o envio leva a tag `appmax-<pedido>`; antes de criar procuramos essa tag.
 * - MELHORENVIO_AUTO_BUY=false só cria o envio no carrinho (a compra fica manual).
 * - Se a compra falhar (saldo, permissão do token), o envio fica no carrinho e o erro vai para o log.
 */
export type LabelResult =
  | { status: "ja-existe"; shipmentId?: string | undefined; protocol?: string | undefined }
  | { status: "liberada"; shipmentId: string; protocol?: string | undefined }
  | { status: "no-carrinho"; shipmentId: string; protocol?: string | undefined; motivo: string }
  | { status: "duplicada-removida" };

/** Dados da loja como cadastrados no Melhor Envio. Qualquer um pode ser trocado por STORE_* sem mexer no código. */
const sender = (order: PaidOrder): Sender => ({
  name: env("STORE_NAME", "Vonix Hair"),
  email: env("STORE_EMAIL", "lucassiqueirahotmail22@gmail.com"),
  phone: env("STORE_PHONE", "31971185662").replace(/\D/g, ""),
  cnpj: (env("STORE_CNPJ") || order.sellerCnpj).replace(/\D/g, ""),
  address: env("STORE_ADDRESS", "Rua José Pedro De Carvalho"),
  number: env("STORE_NUMBER", "30"),
  complement: env("STORE_COMPLEMENT", "Indústria"),
  district: env("STORE_DISTRICT", "São João Batista"),
  city: env("STORE_CITY", "Santa Luzia"),
  state: env("STORE_UF", "MG"),
  postcode: env("STORE_ORIGIN_CEP", "33030810").replace(/\D/g, ""),
});

type Shipment = { id: string; protocol?: string; tags?: unknown };

/** Envios do cliente já existentes com a tag deste pedido. A busca do Melhor Envio aceita CPF/CNPJ do destinatário. */
async function findByTag(order: PaidOrder): Promise<Shipment[]> {
  try {
    const found = await melhorEnvio<Shipment[]>(
      "GET",
      `/api/v2/me/orders/search?q=${encodeURIComponent(order.customer.document)}`,
    );
    return (Array.isArray(found) ? found : []).filter((s) => hasOrderTag(s, order.id));
  } catch (e) {
    // "Nenhum resultado" volta como 400/404; qualquer outro erro precisa parar a criação para não duplicar.
    if (/ (400|404):/.test(String((e as Error).message))) return [];
    throw e;
  }
}

const inFlight = new Map<number, Promise<LabelResult>>();

/** Cria (uma única vez por pedido) a etiqueta do pedido pago. */
export function createLabelForPaidOrder(rawOrder: Record<string, unknown>): Promise<LabelResult> {
  const order = parsePaidOrder(rawOrder);
  if (!order)
    return Promise.reject(new Error("Pedido pago sem os dados de entrega que a etiqueta exige"));
  const running = inFlight.get(order.id);
  if (running) return running;
  const job = run(order).finally(() => inFlight.delete(order.id));
  inFlight.set(order.id, job);
  return job;
}

async function run(order: PaidOrder): Promise<LabelResult> {
  const existing = await findByTag(order);
  if (existing.length)
    return { status: "ja-existe", shipmentId: existing[0]?.id, protocol: existing[0]?.protocol };

  const units = order.units;
  const quotes = await calculateShipping(order.customer.postcode, [
    { id: `pedido-${order.id}`, unitPrice: order.productsTotal / units, quantity: units },
  ]);
  const service = pickService(quotes, order.freightType, order.freightValue);
  if (!service) throw new Error(`Sem cotação de frete para o CEP ${order.customer.postcode}`);

  const body = buildCartBody(
    order,
    service.id,
    sender(order),
    packageSize(),
    env("MELHORENVIO_NON_COMMERCIAL", "true") !== "false",
  );
  const cart = await melhorEnvio<{ id: string; protocol?: string }>(
    "POST",
    "/api/v2/me/cart",
    body,
  );

  // Dois avisos quase juntos podem criar dois envios: só o de menor id segue, o outro é removido.
  const same = await findByTag(order);
  const ids = [...new Set([cart.id, ...same.map((s) => s.id)])].sort();
  if (ids.length > 1 && ids[0] !== cart.id) {
    await melhorEnvio("DELETE", `/api/v2/me/cart/${cart.id}`).catch((e) =>
      console.error("[etiqueta] não removeu a duplicada", e),
    );
    return { status: "duplicada-removida" };
  }

  if (env("MELHORENVIO_AUTO_BUY", "true") === "false") {
    return {
      status: "no-carrinho",
      shipmentId: cart.id,
      protocol: cart.protocol,
      motivo: "compra automática desligada",
    };
  }
  try {
    await melhorEnvio("POST", "/api/v2/me/shipment/checkout", { orders: [cart.id] });
    await melhorEnvio("POST", "/api/v2/me/shipment/generate", { orders: [cart.id] });
    return { status: "liberada", shipmentId: cart.id, protocol: cart.protocol };
  } catch (e) {
    return {
      status: "no-carrinho",
      shipmentId: cart.id,
      protocol: cart.protocol,
      motivo: String((e as Error).message).slice(0, 200),
    };
  }
}

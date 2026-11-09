import { env, requireEnv } from "./env.server";

const hosts = () =>
  env("APPMAX_ENV") === "production"
    ? { auth: "https://auth.appmax.com.br", api: "https://api.appmax.com.br" }
    : { auth: "https://auth.sandboxappmax.com.br", api: "https://api.sandboxappmax.com.br" };

let cached: { token: string; expiresAt: number } | null = null;

async function getToken(force = false) {
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${hosts().auth}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: requireEnv("APPMAX_CLIENT_ID"),
      client_secret: requireEnv("APPMAX_CLIENT_SECRET"),
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Appmax auth ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function appmax<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  retried = false,
): Promise<T> {
  const res = await fetch(`${hosts().api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getToken(retried)}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401 && !retried) return appmax<T>(method, path, body, true);
  const text = await res.text();
  if (!res.ok) throw new Error(`Appmax ${method} HTTP ${res.status}`);
  return JSON.parse(text) as T;
}

export type AppmaxCustomerInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  document_number: string;
  ip: string;
  address: {
    postcode: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
  };
  tracking?: { utm_source?: string; utm_campaign?: string };
};

export type AppmaxProduct = {
  sku: string;
  name: string;
  quantity: number;
  unit_value: number;
  type: "physical";
};

export const createCustomer = async (c: AppmaxCustomerInput) =>
  (await appmax<{ data: { customer: { id: number } } }>("POST", "/v1/customers", c)).data.customer
    .id;

export const createOrder = async (o: {
  customer_id: number;
  // Products are priced via per-item unit_value; products_value must not be sent too.
  discount_value: number;
  shipping_value: number;
  products: AppmaxProduct[];
}) => (await appmax<{ data: { order: { id: number } } }>("POST", "/v1/orders", o)).data.order.id;

export const payWithPix = async (orderId: number, document: string) => {
  const r = await appmax<{
    data: { payment: { pix_qrcode: string; pix_emv: string; pix_expiration_date: string } };
  }>("POST", "/v1/payments/pix", {
    order_id: orderId,
    payment_data: { pix: { document_number: document } },
  });
  return r.data.payment;
};

export const payWithCard = (p: {
  orderId: number;
  customerId: number;
  token: string;
  holderName: string;
  document: string;
  installments: number;
}) =>
  appmax("POST", "/v1/payments/credit-card", {
    order_id: p.orderId,
    customer_id: p.customerId,
    payment_data: {
      credit_card: {
        token: p.token,
        holder_document_number: p.document,
        holder_name: p.holderName,
        installments: p.installments,
        soft_descriptor: "VONIXHAIR",
      },
    },
  });

export type AppmaxOrder = {
  data: {
    order: { id: number; status: string };
    payment?: { paid_at?: string | null; method?: string };
  };
};
/** The merchant API may fail, drift, or return an unexpected order payload.
 * Never use a status for a different order to authorize ERP/Meta/payment actions.
 */
export function assertAppmaxOrder(order: AppmaxOrder, requestedId: number): void {
  if (
    !Number.isSafeInteger(requestedId) ||
    requestedId <= 0 ||
    !order ||
    typeof order !== "object" ||
    !order.data ||
    typeof order.data !== "object" ||
    !order.data.order ||
    typeof order.data.order !== "object" ||
    order.data.order.id !== requestedId ||
    typeof order.data.order.status !== "string" ||
    !order.data.order.status.trim() ||
    order.data.order.status.length > 100
  )
    throw new Error("Appmax retornou um pedido inválido ou diferente do solicitado");
}

export async function getOrder(orderId: number): Promise<AppmaxOrder> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0)
    throw new Error("Identificador de pedido inválido");
  const order = await appmax<AppmaxOrder>("GET", `/v1/orders/${orderId}`);
  assertAppmaxOrder(order, orderId);
  return order;
}

/** Appmax autorizado is still pending antifraud, not paid. Verified against official status guide. */
const PAID = new Set(["aprovado", "integrado", "pendente_integracao"]);
export const isPaid = (o: AppmaxOrder) =>
  PAID.has(String(o.data.order.status).trim().toLowerCase());
/** Only integrado is ready for physical fulfillment; approved can still await integration. */
export const isReadyForFulfillment = (o: AppmaxOrder) =>
  String(o.data.order.status).trim().toLowerCase() === "integrado";

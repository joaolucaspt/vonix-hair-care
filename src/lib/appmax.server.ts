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
  });
  if (!res.ok) throw new Error(`Appmax auth ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function appmax<T>(method: "GET" | "POST", path: string, body?: unknown, retried = false): Promise<T> {
  const res = await fetch(`${hosts().api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getToken(retried)}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401 && !retried) return appmax<T>(method, path, body, true);
  const text = await res.text();
  if (!res.ok) throw new Error(`Appmax ${method} ${path} ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as T;
}

export type AppmaxCustomerInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  document_number: string;
  ip: string;
  address: { postcode: string; street: string; number: string; complement: string; district: string; city: string; state: string };
  tracking?: { utm_source?: string; utm_campaign?: string };
};

export type AppmaxProduct = { sku: string; name: string; quantity: number; unit_value: number; type: "physical" };

export const createCustomer = async (c: AppmaxCustomerInput) =>
  (await appmax<{ data: { customer: { id: number } } }>("POST", "/v1/customers", c)).data.customer.id;

export const createOrder = async (o: {
  customer_id: number;
  products_value: number;
  discount_value: number;
  shipping_value: number;
  products: AppmaxProduct[];
}) => (await appmax<{ data: { order: { id: number } } }>("POST", "/v1/orders", o)).data.order.id;

export const payWithPix = async (orderId: number, document: string) => {
  const r = await appmax<{ data: { payment: { pix_qrcode: string; pix_emv: string; pix_expiration_date: string } } }>(
    "POST",
    "/v1/payments/pix",
    { order_id: orderId, payment_data: { pix: { document_number: document } } },
  );
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
  data: { order: { id: number; status: string }; payment?: { paid_at?: string | null; method?: string } };
};
export const getOrder = (orderId: number) => appmax<AppmaxOrder>("GET", `/v1/orders/${orderId}`);

/** The docs do not list every status string; paid = approved/authorized/integrated, never refunded. */
const PAID = new Set(["aprovado", "autorizado", "integrado", "pago", "approved", "authorized", "paid"]);
export const isPaid = (o: AppmaxOrder) => PAID.has(String(o.data.order.status).toLowerCase());

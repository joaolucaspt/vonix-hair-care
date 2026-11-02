import { createServerFn } from "@tanstack/react-start";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import * as bling from "./bling.server";
import { env } from "./env.server";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Painel interno: pedidos de todos os canais (site, Shopee, TikTok Shop, Magalu) vindos do Bling. Protegido por PANEL_PASSWORD. */
export const getPainel = createServerFn({ method: "POST" })
  .inputValidator(z.object({ password: z.string().max(200), days: z.number().int().min(1).max(90) }))
  .handler(async ({ data }) => {
    const secret = env("PANEL_PASSWORD");
    if (!secret) return { ok: false as const, reason: "Painel desligado: cadastre PANEL_PASSWORD nos Secrets do Lovable." };
    if (!same(data.password, secret)) return { ok: false as const, reason: "Senha incorreta." };
    if (!bling.blingEnabled()) return { ok: false as const, reason: "Bling ainda não conectado: faltam BLING_CLIENT_ID, BLING_CLIENT_SECRET e BLING_REFRESH_TOKEN." };
    try {
      return { ok: true as const, orders: await bling.listOrders(data.days) };
    } catch (e) {
      console.error("[painel]", e);
      return { ok: false as const, reason: "Não consegui ler os pedidos do Bling agora." };
    }
  });

export const getPedido = createServerFn({ method: "POST" })
  .inputValidator(z.object({ password: z.string().max(200), id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const secret = env("PANEL_PASSWORD");
    if (!secret || !same(data.password, secret) || !bling.blingEnabled()) return { ok: false as const };
    try {
      return { ok: true as const, pedido: await bling.getOrderDetail(data.id) };
    } catch (e) {
      console.error("[painel] pedido", e);
      return { ok: false as const };
    }
  });
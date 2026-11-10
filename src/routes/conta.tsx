import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Page, Shell } from "@/components/site";
import { WHATSAPP } from "@/lib/store";
import { getOrderStatus } from "@/lib/checkout.functions";
import { restorePendingPix } from "@/lib/pending-pix";
import { restorePendingCard } from "@/lib/pending-card";
import { isTerminatedOrder } from "@/lib/order-events";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Meus pedidos — Vonix Hair" },
      {
        name: "description",
        content: "Consulte pedidos recentes neste navegador ou fale com o atendimento Vonix Hair.",
      },
      { property: "og:title", content: "Meus pedidos — Vonix Hair" },
      {
        property: "og:description",
        content: "Consulte pagamentos recentes ou fale com o atendimento.",
      },
    ],
  }),
  component: Conta,
});

type LocalOrder = {
  orderId: number;
  statusToken: string;
  method: "Pix" | "Cartão" | "Não confirmado";
  checking: boolean;
  result: "paid" | "pending" | "ended" | null;
  error: boolean;
};

function localOrders(): LocalOrder[] {
  const orders: LocalOrder[] = [];
  const card = restorePendingCard();
  const pix = restorePendingPix();
  if (card) {
    orders.push({
      orderId: card.orderId,
      statusToken: card.statusToken,
      method: card.verificationOnly ? "Não confirmado" : "Cartão",
      checking: false,
      // SessionStorage is untrusted: only getOrderStatus can confirm payment.
      result: null,
      error: false,
    });
  }
  if (pix && !orders.some((o) => o.orderId === pix.orderId)) {
    orders.push({
      orderId: pix.orderId,
      statusToken: pix.statusToken,
      method: "Pix",
      checking: false,
      result: null,
      error: false,
    });
  }
  return orders;
}

function Conta() {
  const getStatus = useServerFn(getOrderStatus);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const checkingIds = useRef(new Set<number>());

  // Session data is intentionally read only after hydration. Never place the
  // signed status capability into URLs, analytics, page metadata or rendered HTML.
  useEffect(() => setOrders(localOrders()), []);

  const check = async (order: LocalOrder) => {
    // Ref lock prevents rapid double clicks from issuing parallel status RPCs.
    if (order.checking || checkingIds.current.has(order.orderId)) return;
    checkingIds.current.add(order.orderId);
    setOrders((current) =>
      current.map((o) =>
        o.orderId === order.orderId ? { ...o, checking: true, error: false } : o,
      ),
    );
    try {
      const response = await getStatus({
        data: { orderId: order.orderId, statusToken: order.statusToken },
      });
      setOrders((current) =>
        current.map((o) =>
          o.orderId !== order.orderId
            ? o
            : {
                ...o,
                checking: false,
                error: !response.ok,
                result: !response.ok
                  ? null
                  : response.paid
                    ? "paid"
                    : isTerminatedOrder(response.status)
                      ? "ended"
                      : "pending",
              },
        ),
      );
    } catch {
      setOrders((current) =>
        current.map((o) =>
          o.orderId === order.orderId ? { ...o, checking: false, error: true, result: null } : o,
        ),
      );
    } finally {
      checkingIds.current.delete(order.orderId);
    }
  };

  return (
    <Shell>
      <Page>
        <h1 className="font-display text-h1">Meus pedidos</h1>
        <p className="mt-3 text-body text-muted-foreground">
          Consulte pedidos ainda em andamento neste navegador, sem precisar criar uma conta. A
          consulta não cria cobranças nem altera o pagamento.
        </p>
        {orders.length ? (
          <section aria-label="Pedidos disponíveis neste navegador" className="mt-6 space-y-4">
            {orders.map((order) => (
              <div key={order.orderId} className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-semibold text-name">Pedido nº {order.orderId}</h2>
                <p className="mt-1 text-body text-muted-foreground">Pagamento: {order.method}</p>
                <div aria-live="polite" className="mt-3 text-body">
                  {order.error ? (
                    <p role="alert">
                      Não foi possível confirmar o status agora. Consulte o atendimento antes de
                      tentar pagar novamente.
                    </p>
                  ) : order.result === "paid" ? (
                    <p>
                      Pagamento confirmado pela Appmax. Para rastreio de entrega, fale com o
                      atendimento.
                    </p>
                  ) : order.result === "ended" ? (
                    <p>
                      A Appmax informou que esta tentativa foi encerrada. Consulte o atendimento
                      antes de tentar novamente.
                    </p>
                  ) : order.result === "pending" ? (
                    <p>
                      Pagamento ainda não confirmado. Não gere uma nova cobrança antes de verificar
                      a situação.
                    </p>
                  ) : (
                    <p>
                      Esta tentativa está registrada nesta aba, mas o status ainda precisa ser
                      consultado.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="mt-4 min-h-11 rounded-full border border-border px-5 py-2.5 text-body font-semibold disabled:opacity-60"
                  onClick={() => void check(order)}
                  disabled={order.checking}
                  aria-label={`Consultar pedido ${order.orderId}`}
                >
                  {order.checking ? "Consultando…" : "Consultar status"}
                </button>
              </div>
            ))}
          </section>
        ) : (
          <p role="note" className="mt-6 rounded-lg border border-border bg-muted p-4 text-body">
            Nenhum pedido recente disponível nesta aba. A consulta rápida só funciona enquanto o
            navegador mantém a sessão do pagamento. Para pedidos antigos, compras em outro aparelho
            ou acompanhamento de entrega, utilize o atendimento.
          </p>
        )}
        <p role="note" className="mt-6 rounded-lg border border-border bg-muted p-4 text-body">
          <b>Precisa de ajuda?</b> Para consultar pedidos anteriores, solicitar troca ou obter
          rastreio, informe o número do pedido ao{" "}
          <a href={WHATSAPP} target="_blank" rel="noreferrer" className="underline">
            WhatsApp Vonix Hair
          </a>
          .
        </p>
        <Link
          to="/loja"
          className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-action-foreground"
        >
          Ver produtos
        </Link>
      </Page>
    </Shell>
  );
}

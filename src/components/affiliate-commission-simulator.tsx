import { useMemo, useState, type FormEvent } from "react";
import { Calculator, RotateCcw, ShieldCheck, Plus, XCircle, CheckCircle2 } from "lucide-react";
import {
  simulateAffiliateCommissions,
  simulationRefValid,
  type SimulationEvent,
  type SimulationEventStatus,
} from "@/lib/affiliate-commission-simulator";

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const example: SimulationEvent[] = [
  { orderId: "EX001", ref: "marina", status: "pendente", amountCents: 19990 },
  { orderId: "EX001", ref: "marina", status: "pago" },
  { orderId: "EX002", ref: "ana", status: "pendente", amountCents: 29900 },
  { orderId: "EX002", ref: "ana", status: "pago" },
  { orderId: "EX002", ref: "ana", status: "estornado" },
  { orderId: "EX003", ref: "marina", status: "pendente", amountCents: 15990 },
];

export function AffiliateCommissionSimulator() {
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [rate, setRate] = useState(10);
  const [ref, setRef] = useState("marina");
  const [value, setValue] = useState("199.90");
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const result = useMemo(
    () => simulateAffiliateCommissions(events, Math.round(rate * 100)),
    [events, rate],
  );
  function addOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedRef = ref.trim().toLowerCase();
    const parsed = Number(value.replace(",", "."));
    const cents = Math.round(parsed * 100);
    if (
      !simulationRefValid(normalizedRef) ||
      !Number.isFinite(parsed) ||
      !Number.isSafeInteger(cents) ||
      cents <= 0 ||
      cents > 500_000_000
    ) {
      setError("Use um código simples e valor de R$ 0,01 a R$ 5 milhões.");
      return;
    }
    // Synthetic monotonic identifier; never use customer or payment data.
    const orderId =
      "SIM" + String(events.filter((x) => x.status === "pendente").length + 1).padStart(4, "0");
    setEvents((old) => [
      ...old,
      { orderId, ref: normalizedRef, status: "pendente", amountCents: cents },
    ]);
    setError("");
    setShow(true);
  }
  function addStatus(orderId: string, ref: string, status: SimulationEventStatus) {
    setEvents((old) => [...old, { orderId, ref, status }]);
  }
  const statusLabels = {
    pendente: "Aguardando pagamento",
    pago: "Pagamento simulado",
    cancelado: "Cancelado",
    estornado: "Estornado",
  };
  return (
    <section
      aria-label="Laboratório de comissões em simulação"
      className="mt-6 overflow-hidden rounded-[1.5rem] border border-[#e8dcd8] bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#f0e3df] p-5 sm:p-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[#854d5b]">
            <Calculator className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Planejamento financeiro
            </span>
          </div>
          <h2 className="mt-2 font-display text-2xl">Laboratório de comissões</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#806b70]">
            Simule indicações, pagamentos, cancelamentos e estornos antes de aprovar o regulamento.
            Nenhuma venda, comissão, cupom ou pagamento real é criado. A taxa abaixo é apenas uma
            hipótese, não uma promessa de remuneração.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShow((x) => !x)}
          aria-expanded={show}
          className="min-h-11 rounded-full border border-[#d6b6be] px-5 text-sm font-semibold text-[#733e4a] hover:bg-[#fbefec]"
        >
          {show ? "Ocultar laboratório" : "Abrir laboratório"}
        </button>
      </div>
      {show && (
        <div className="space-y-5 p-5 sm:p-6">
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl bg-[#fbf4ee] px-4 py-3 text-sm text-[#845a48]"
          >
            <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            Ambiente 100% simulado · Sem conexão com a Appmax, Supabase ou checkout · Sem
            armazenamento persistente
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[#654c52]">
              Comissão hipotética (%)
              <input
                type="number"
                min={0}
                max={30}
                step="0.5"
                value={rate}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 0 && n <= 30) setRate(Math.round(n * 2) / 2);
                }}
                className="mt-2 min-h-11 w-full rounded-xl border border-[#dbc3c7] bg-white px-4 text-base"
              />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEvents(example);
                  setRate(10);
                  setError("");
                }}
                className="min-h-11 rounded-full border border-[#cc9faa] px-5 text-sm font-semibold text-[#783b4a]"
              >
                Carregar cenário fictício
              </button>
              <button
                type="button"
                onClick={() => {
                  setEvents([]);
                  setError("");
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e1d2d2] px-5 text-sm font-semibold text-[#685d5d]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Limpar
              </button>
            </div>
          </div>
          <form
            onSubmit={addOrder}
            className="grid gap-3 rounded-2xl border border-[#f0e3df] bg-[#fffaf8] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <label className="text-sm font-semibold text-[#654c52]">
              Código de indicação fictício
              <input
                type="text"
                maxLength={30}
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="marina"
                required
                pattern="[a-zA-Z0-9-]{1,30}"
                className="mt-2 min-h-11 w-full rounded-xl border border-[#dbc3c7] bg-white px-4 text-base"
              />
            </label>
            <label className="text-sm font-semibold text-[#654c52]">
              Valor do pedido hipotético (R$)
              <input
                type="number"
                min="0.01"
                max="5000000"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                className="mt-2 min-h-11 w-full rounded-xl border border-[#dbc3c7] bg-white px-4 text-base"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#743846] px-5 text-sm font-semibold text-white hover:bg-[#602c38]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Criar pedido
            </button>
            {error && (
              <p role="alert" className="text-sm text-red-700 sm:col-span-3">
                {error}
              </p>
            )}
          </form>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["Vendas pagas válidas", result.paidOrders.toString()],
                ["Receita paga simulada", money(result.eligibleSalesCents)],
                ["Comissão estimada", money(result.estimatedCommissionCents)],
                ["Comissões estornadas", money(result.reversedCommissionCents)],
              ] as const
            ).map(([label, number]) => (
              <div key={label} className="rounded-2xl border border-[#ebdddd] bg-white p-4">
                <p className="text-xs text-[#8a7377]">{label}</p>
                <p className="mt-2 font-display text-2xl font-semibold text-[#633e49]">{number}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#8b7779]">
            {result.pendingOrders} pendente(s) · {result.reversedOrders} cancelado(s)/estornado(s) ·{" "}
            {result.duplicateEvents} evento(s) duplicado(s) · {result.rejectedEvents} evento(s)
            rejeitado(s). Cálculo em centavos, sem tributos, frete, devoluções parciais ou regras
            comerciais aprovadas.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-[#ebdddd]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#fbf3f1] text-xs uppercase tracking-wider text-[#856971]">
                <tr>
                  <th className="p-3">Pedido sintético</th>
                  <th className="p-3">Referência</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ações simuladas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e6e3]">
                {result.orders.map((order) => (
                  <tr key={order.orderId}>
                    <td className="p-3 font-semibold">{order.orderId}</td>
                    <td className="p-3">{order.ref}</td>
                    <td className="p-3">{money(order.amountCents)}</td>
                    <td className="p-3">{statusLabels[order.status]}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        {order.status === "pendente" && (
                          <>
                            <button
                              type="button"
                              onClick={() => addStatus(order.orderId, order.ref, "pago")}
                              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-emerald-200 px-3 text-xs font-semibold text-emerald-800"
                            >
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Simular pago
                            </button>
                            <button
                              type="button"
                              onClick={() => addStatus(order.orderId, order.ref, "cancelado")}
                              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-rose-200 px-3 text-xs font-semibold text-rose-700"
                            >
                              <XCircle className="h-4 w-4" aria-hidden="true" /> Cancelar
                            </button>
                          </>
                        )}
                        {order.status === "pago" && (
                          <button
                            type="button"
                            onClick={() => addStatus(order.orderId, order.ref, "estornado")}
                            className="inline-flex min-h-10 items-center gap-1 rounded-full border border-rose-200 px-3 text-xs font-semibold text-rose-700"
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Simular estorno
                          </button>
                        )}
                        {(order.status === "cancelado" || order.status === "estornado") && (
                          <span className="text-xs text-[#8b7779]">Encerrado</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!result.orders.length && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm text-[#8b7779]">
                      Nenhum pedido fictício ainda. Crie um ou carregue o cenário de exemplo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LOGO } from "@/components/site";
import { getPainel, getPedido } from "@/lib/painel.functions";
import { brl } from "@/lib/store";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Vonix Pedidos" }, { name: "robots", content: "noindex,nofollow" }, { name: "theme-color", content: "#1a1510" }], links: [{ rel: "manifest", href: "/painel.webmanifest" }, { rel: "apple-touch-icon", href: "/vonix-pedidos-192.png" }] }),
  component: Painel,
});

type Detalhe = { cliente: string; documento: string; email: string; telefone: string; endereco: string; frete: number; desconto: number; observacoes: string; itens: { descricao: string; quantidade: number; valor: number; custo: number }[]; custoTotal: number; lucro: number };
type Order = { id: number; numero: number; data: string; total: number; cliente: string; situacao: string; canal: string };

function Painel() {
  const [password, setPassword] = useState("");
  const [days, setDays] = useState(30);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [canal, setCanal] = useState("");
  const [aba, setAba] = useState<"pedidos" | "canais">("pedidos");
  const [aberto, setAberto] = useState<number | null>(null);
  const [detalhes, setDetalhes] = useState<Record<number, Detalhe | "erro">>({});

  const abrir = async (id: number) => {
    setAberto(aberto === id ? null : id);
    if (detalhes[id]) return;
    const r = await getPedido({ data: { password, id } });
    setDetalhes((d) => ({ ...d, [id]: r.ok ? r.pedido : "erro" }));
  };

  const load = async (d = days) => {
    setLoading(true);
    setError("");
    try {
      const r = await getPainel({ data: { password, days: d } });
      if (r.ok) setOrders(r.orders);
      else {
        setOrders(null);
        setError(r.reason);
      }
    } catch {
      setError("Falha ao carregar. Tente de novo.");
    }
    setLoading(false);
  };

  const resumo = useMemo(() => {
    const m = new Map<string, { n: number; total: number }>();
    for (const o of orders ?? []) {
      const c = m.get(o.canal) ?? { n: 0, total: 0 };
      c.n += 1;
      c.total += o.total;
      m.set(o.canal, c);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [orders]);
  const lista = (orders ?? []).filter((o) => !canal || o.canal === canal);
  const totalGeral = resumo.reduce((s, [, c]) => s + c.total, 0);

  const sair = () => {
    setOrders(null);
    setPassword("");
    setDetalhes({});
    setAberto(null);
    setCanal("");
  };
  const pill = "inline-flex h-11 items-center justify-center rounded-full bg-foreground px-8 text-small font-semibold text-background disabled:opacity-50";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container-site flex h-16 items-center justify-between">
          <img src={LOGO} alt="Vonix Hair" className="h-10 w-auto" />
          {orders && (
            <button onClick={sair} className="inline-flex h-10 items-center rounded-full border border-foreground px-5 text-small font-semibold">
              Sair
            </button>
          )}
        </div>
      </header>

      <main className="container-site py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-h1">Vonix Pedidos</h1>
          {orders && (
            <select value={days} onChange={(e) => { const d = Number(e.target.value); setDays(d); void load(d); }} className="h-11 rounded-full border border-border bg-card px-4 text-small font-semibold">
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          )}
        </div>
        <p className="mt-1 text-muted-foreground">De onde veio cada pedido: site, Shopee, TikTok Shop e Magalu num lugar só.</p>

        {!orders && (
          <form onSubmit={(e) => { e.preventDefault(); void load(); }} className="mt-8 grid max-w-md gap-4 rounded-2xl border border-dashed border-border p-6">
            <label className="grid gap-1 text-small">
              Senha do painel
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-12 rounded-xl border border-border bg-card px-4 text-body" />
            </label>
            {error && <p role="alert" className="text-small text-red-700">{error}</p>}
            <button type="submit" disabled={loading || !password} className={pill}>{loading ? "Carregando…" : "Ver pedidos"}</button>
          </form>
        )}

        {orders && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1.5">
              {([["pedidos", "Pedidos"], ["canais", "Canais"]] as const).map(([k, nome]) => (
                <button key={k} onClick={() => setAba(k)} className={`h-12 rounded-xl text-small font-semibold ${aba === k ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                  {nome}
                </button>
              ))}
            </div>

            {aba === "canais" && (
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <button onClick={() => { setCanal(""); setAba("pedidos"); }} className="rounded-2xl border border-border bg-card p-4 text-left">
                  <div className="text-small text-muted-foreground">Todos os canais</div>
                  <div className="font-display text-price">{brl(totalGeral)}</div>
                  <div className="text-small">{orders.length} pedidos</div>
                </button>
                {resumo.map(([nome, c]) => (
                  <button key={nome} onClick={() => { setCanal(nome); setAba("pedidos"); }} className="rounded-2xl border border-border bg-card p-4 text-left">
                    <div className="text-small text-muted-foreground">{nome}</div>
                    <div className="font-display text-price">{brl(c.total)}</div>
                    <div className="text-small">{c.n} pedidos · ticket {brl(c.total / c.n)}</div>
                  </button>
                ))}
              </div>
            )}

            {aba === "pedidos" && (
              <div className="mt-6 grid gap-3">
                {canal && (
                  <button onClick={() => setCanal("")} className="w-fit rounded-full bg-muted px-4 py-2 text-small font-semibold">
                    Canal: {canal} ✕
                  </button>
                )}
                {lista.length === 0 && (
                  <div className="grid place-items-center gap-5 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
                    <div className="font-display text-h2">Nenhum pedido no período</div>
                    <button onClick={() => { setCanal(""); setDays(90); void load(90); }} className={pill}>Ver últimos 90 dias</button>
                  </div>
                )}
                {lista.map((o) => {
                  const d = detalhes[o.id];
                  return (
                    <div key={o.id} className="rounded-2xl border border-border bg-card">
                      <button onClick={() => void abrir(o.id)} className="grid w-full gap-1 p-4 text-left">
                        <div className="flex items-center justify-between gap-3">
                          <strong>Pedido #{o.numero}</strong>
                          <span className="rounded-full bg-action px-3 py-1 text-small text-action-foreground">{o.canal}</span>
                        </div>
                        <div className="text-small text-muted-foreground">{o.data} · {o.cliente}</div>
                        <div className="font-display text-price">{brl(o.total)}</div>
                      </button>
                      {aberto === o.id && (
                        <div className="border-t border-border bg-muted/50 p-4 text-small">
                          {!d && <span className="text-muted-foreground">Carregando detalhes…</span>}
                          {d === "erro" && <span className="text-red-700">Não consegui abrir este pedido.</span>}
                          {d && d !== "erro" && (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="grid gap-1">
                                <div><strong>Cliente:</strong> {d.cliente}</div>
                                <div><strong>CPF/CNPJ:</strong> {d.documento || "—"}</div>
                                <div><strong>Telefone:</strong> {d.telefone ? <a className="underline" href={`https://wa.me/55${d.telefone.replace(/\D/g, "")}`}>{d.telefone}</a> : "—"}</div>
                                <div><strong>E-mail:</strong> {d.email || "—"}</div>
                                <div><strong>Endereço de entrega:</strong> {d.endereco || "—"}</div>
                                {d.observacoes && <div><strong>Obs.:</strong> {d.observacoes}</div>}
                              </div>
                              <div className="grid gap-1">
                                {d.itens.map((i, k) => (
                                  <div key={k}>{i.quantidade}× {i.descricao} — vendido {brl(i.valor * i.quantidade)}{i.custo > 0 ? ` · custo ${brl(i.custo * i.quantidade)}` : " · custo não cadastrado"}</div>
                                ))}
                                <div>Frete: {brl(d.frete)}{d.desconto > 0 ? ` · Desconto: ${brl(d.desconto)}` : ""}</div>
                                <div className="font-semibold">Valor do pedido: {brl(o.total)}</div>
                                <div>Custo dos produtos (o que pagamos): {brl(d.custoTotal)}</div>
                                <div className="font-semibold">Lucro estimado: {brl(d.lucro)} <span className="font-normal text-muted-foreground">(sem taxas do canal)</span></div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
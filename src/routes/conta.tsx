import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Shell } from "@/components/site";
import { WHATSAPP } from "@/lib/store";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta e pedidos — Vonix Hair" },
      { name: "description", content: "Acesse sua conta e seus pedidos Vonix Hair." },
      { property: "og:title", content: "Minha conta — Vonix Hair" },
      { property: "og:description", content: "Acesse sua conta e seus pedidos." },
    ],
  }),
  component: Conta,
});

function Conta() {
  return (
    <Shell>
      <Page>
        <h1 className="font-display text-h1">Meus pedidos</h1>

        <p role="note" className="mt-4 rounded-lg border border-foreground bg-muted p-4 text-body">
          <b>Acompanhe seu pedido pelo WhatsApp.</b> Você não precisa de cadastro para comprar. Para saber o status, o rastreio ou pedir troca, fale com a gente informando o número do pedido:{" "}
          <a href={WHATSAPP} target="_blank" rel="noreferrer" className="underline">WhatsApp Vonix Hair</a>.
        </p>
        <Link to="/loja" className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-action-foreground">Ver produtos</Link>
      </Page>
    </Shell>
  );
}

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Md } from "@/components/site";
import { NEEDS, TYPES, USAGE, isProOnly, type Product } from "@/lib/store";

/** Splits the catalog markdown into its intro and its **TITLE** blocks (COMO USAR, COMPOSIÇÃO E ATIVOS...). */
function parse(desc: string) {
  const [intro = "", ...rest] = desc.split(/\n\s*---\s*\n/);
  const sections: Record<string, string> = {};
  for (const b of rest) {
    const m = b.trim().match(/^\*\*([^*]+)\*\*\s*\n?([\s\S]*)$/);
    if (m?.[1] && m[2] !== undefined) sections[m[1].trim().toUpperCase()] = m[2].trim();
  }
  return { intro: intro.trim(), sections };
}

/** Only facts we can derive from the catalog itself; nothing invented (no hair type, no "cruelty free"). */
function specs(p: Product) {
  const text = `${p.name} ${p.description}`;
  const needs = Object.entries(NEEDS).filter(([, re]) => re.test(text)).map(([k]) => k).slice(0, 3);
  const types = Object.entries(TYPES).filter(([, f]) => f(p)).map(([k]) => k);
  const casa = !!USAGE["casa"]?.(p);
  const salao = !!USAGE["salao"]?.(p);
  const uso = isProOnly(p.slug) ? "Profissional (salão)" : casa && salao ? "Casa e salão" : salao ? "Profissional (salão)" : "Cuidado em casa";
  const sizes = [...new Set(p.variants.map((v) => v.label.replace(/^[^\d]*/, "").replace(/\s+/g, "")).filter(Boolean))].join(" · ");
  const items = (parse(p.description).sections["O QUE VEM NO COMBO"] ?? "").split("\n").filter((l) => l.trim().startsWith("**")).length;
  const rows: [string, string][] = [
    ["Categorias", `Cabelos › ${p.categoryLabel}`],
    ["Este combo contém", items ? `${items} produtos` : ""],
    ["Indicado para", needs.join(", ")],
    ["Tipo de produto", types.join(", ")],
    ["Tamanho", sizes],
    ["Uso", uso],
    ["Marca", "Vonix Hair"],
  ];
  return rows.filter(([, v]) => v);
}

function Row({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-border first:border-t">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-name [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="pb-5 text-body">{children}</div>
    </details>
  );
}

export function ProductDetails({ p }: { p: Product }) {
  const { intro, sections } = parse(p.description);
  // Intro = short line (already on the card) + lead paragraph; show only the lead here.
  const blocks = intro.split(/\n{2,}/);
  const details = blocks.length > 1 ? blocks.slice(1).join("\n\n") : intro;
  const action = sections["AÇÃO / RESULTADO"];
  const contains = sections["O QUE VEM NO COMBO"] ?? sections["O QUE VEM NO KIT"];
  const sizes = p.variants.map((v) => v.label.replace(/^[^\d]*/, "").replace(/\s+/g, "")).filter(Boolean).join(" · ");
  return (
    <section className="mx-auto mt-16 max-w-3xl" aria-label="Informações do produto">
      <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
        {specs(p).map(([k, v]) => (
          <div key={k}>
            <dt className="text-body font-semibold">{k}</dt>
            <dd className="text-body text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8">
        <Row title="Detalhes" open><Md text={details} /></Row>
        {sections["COMO USAR"] && <Row title="Como usar"><Md text={sections["COMO USAR"]} /></Row>}
        {action && <Row title="Ação / Resultado"><Md text={action} /></Row>}
        <Row title="Este item contém">
          {contains ? <Md text={contains} /> : <p>1 unidade de {p.name}{sizes ? ` (${sizes})` : ""}.</p>}
        </Row>
        {sections["ATIVOS E FUNÇÃO"] && <Row title="Ativos e função"><Md text={sections["ATIVOS E FUNÇÃO"]} /></Row>}
        {sections["APRESENTAÇÃO"] && <Row title="Apresentação"><Md text={sections["APRESENTAÇÃO"]} /></Row>}
        {sections["ENTREGA E TROCA"] && <Row title="Entrega e troca"><Md text={sections["ENTREGA E TROCA"]} /></Row>}
      </div>
    </section>
  );
}

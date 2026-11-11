import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ClipboardCheck, LockKeyhole, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { AffiliateShell } from "@/components/affiliate-shell";
import { getAffiliateStatusByCode } from "@/lib/affiliate-functions";
import { affiliateRejectionLabel, affiliateRejectionGuidance } from "@/lib/affiliate-rejection";

export const Route = createFileRoute("/consultar-candidatura")({
  head: () => ({
    meta: [
      { title: "Consultar candidatura | Vonix Hair" },
      { name: "robots", content: "noindex,nofollow,noarchive" },
    ],
  }),
  component: AffiliateTrackingCodePage,
});

type Result = {
  status: "pendente" | "aprovada" | "recusada";
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export function AffiliateTrackingCodePage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^[A-Za-z0-9_-]{32}$/.test(code)) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await getAffiliateStatusByCode({ data: { code } });
      if (!response.ok) setError(response.reason);
      else
        setResult({
          status: response.status,
          rejectionReason: response.rejectionReason,
          submittedAt: response.submittedAt,
          reviewedAt: response.reviewedAt,
        });
    } catch {
      setError("Falha ao consultar. Confira sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AffiliateShell mode="account">
      <main className="min-h-[75vh] bg-[#faf5f0] px-5 py-14 text-[#392832] sm:py-20">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <LockKeyhole className="mx-auto h-9 w-9 text-[#825164]" aria-hidden="true" />
            <h1 className="mt-4 font-display text-4xl">Consulte sua candidatura</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#775d65]">
              Para inscrições feitas sem e-mail, use o código privado que apareceu na confirmação do
              cadastro. Não compartilhe este código com outras pessoas.
            </p>
          </div>
          <section className="rounded-[2rem] border border-[#e8d7d3] bg-white p-6 shadow-lg sm:p-10">
            <form onSubmit={(event) => void check(event)}>
              <label htmlFor="affiliate-private-code" className="block text-sm font-bold">
                Código privado de acompanhamento
              </label>
              <input
                id="affiliate-private-code"
                aria-label="Código privado de acompanhamento"
                autoComplete="off"
                spellCheck={false}
                maxLength={32}
                minLength={32}
                pattern="[A-Za-z0-9_-]{32}"
                required
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.trim());
                  setResult(null);
                  setError("");
                }}
                placeholder="Cole o código salvo após sua inscrição"
                className="mt-2 min-h-12 w-full rounded-xl border border-[#dac4c8] px-4 font-semibold text-sm outline-none focus:ring-2 focus:ring-[#e6c8ce]"
              />
              <button
                type="submit"
                disabled={busy || !/^[A-Za-z0-9_-]{32}$/.test(code)}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#633847] px-5 font-bold text-white disabled:opacity-50"
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                {busy ? "Consultando..." : "Consultar minha inscrição"}
              </button>
            </form>
            {error && (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {error}
              </p>
            )}
            {result && (
              <div
                role="status"
                className="mt-7 rounded-2xl border border-[#e4d2d3] bg-[#fffbf9] p-5"
              >
                <div className="flex items-center gap-3">
                  {result.status === "recusada" ? (
                    <XCircle aria-hidden="true" className="h-6 w-6 text-[#9a505b]" />
                  ) : result.status === "aprovada" ? (
                    <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-emerald-700" />
                  ) : (
                    <Clock3 aria-hidden="true" className="h-6 w-6 text-amber-700" />
                  )}
                  <h2 className="font-display text-2xl">
                    {result.status === "recusada"
                      ? "Candidatura não selecionada"
                      : result.status === "aprovada"
                        ? "Candidatura aprovada"
                        : "Candidatura em análise"}
                  </h2>
                </div>
                <p className="mt-3 text-sm text-[#70525c]">
                  Inscrição recebida em {new Date(result.submittedAt).toLocaleDateString("pt-BR")}.
                </p>
                {result.status === "recusada" && (
                  <>
                    <p className="mt-4 text-sm font-bold text-[#6a3b48]">
                      Motivo: {affiliateRejectionLabel(result.rejectionReason)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[#70525c]">
                      {affiliateRejectionGuidance(result.rejectionReason)}
                    </p>
                    <a
                      href="/seja-afiliada"
                      className="mt-5 inline-block rounded-full bg-[#633847] px-5 py-3 text-sm font-bold text-white"
                    >
                      Quero me candidatar novamente
                    </a>
                  </>
                )}
                {result.status === "aprovada" && (
                  <p className="mt-3 text-sm text-[#70525c]">
                    Aguarde contato oficial da equipe sobre as próximas etapas. Aprovação não
                    garante remuneração.
                  </p>
                )}
                {result.status === "pendente" && (
                  <p className="mt-3 text-sm text-[#70525c]">
                    A equipe ainda está analisando seu perfil. Volte a consultar mais tarde.
                  </p>
                )}
              </div>
            )}
            <p className="mt-6 text-xs leading-relaxed text-[#826c70]">
              Se não salvou o código, entre em contato com a equipe por um canal oficial. Não é
              possível recuperar seu código somente com o Instagram; isso protege seus dados.
              Inscrições antigas com e-mail continuam no{" "}
              <a href="/acompanhar-inscricao" className="font-semibold underline">
                portal de e-mail
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </AffiliateShell>
  );
}

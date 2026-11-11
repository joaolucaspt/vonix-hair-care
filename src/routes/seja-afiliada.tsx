import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { AffiliateShell } from "@/components/affiliate-shell";
import { getAffiliateRecruitmentStatus } from "@/lib/affiliate-functions";
import { AffiliateSimpleForm } from "@/components/affiliate-simple-form";
import { AffiliateLandingIntro, AffiliateLandingFAQ } from "@/components/affiliate-landing";
import { SITE_URL } from "@/lib/store";

export const Route = createFileRoute("/seja-afiliada")({
  head: () => ({
    meta: [
      { title: "Programa de afiliados Vonix Hair | Inscrições" },
      {
        name: "description",
        content:
          "Inscreva-se para seleção de afiliadas Vonix Hair com um formulário rápido de contato, endereço e redes sociais.",
      },
      { property: "og:title", content: "Programa de afiliados Vonix Hair" },
      {
        property: "og:description",
        content: "Inscrição simplificada: nome, telefone, endereço, Instagram e TikTok opcional.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/seja-afiliada" }],
  }),
  component: AffiliateApplicationPage,
});

export function AffiliateApplicationPage() {
  const [recruitment, setRecruitment] = useState<"loading" | "open" | "closed">("loading");
  const [preview, setPreview] = useState(false);
  const [backendDiagnostics, setBackendDiagnostics] = useState({
    storage: false,
    storageDiagnostic: "checking",
    publicNetworkDiagnostic: "checking",
    ingress: false,
    encryption: false,
    emailConfigured: false,
  });
  const [previewHasDraft, setPreviewHasDraft] = useState(false);
  const [confirmPreviewExit, setConfirmPreviewExit] = useState(false);
  // Keep an already-started application mounted if the operator closes
  // recruitment while somebody is filling it in. It becomes read-only preview
  // mode, but never loses the unsent local draft or attempts to POST.
  const [liveFormStarted, setLiveFormStarted] = useState(false);

  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    async function refreshStatus() {
      const requestId = ++latestRequest;
      try {
        const {
          open,
          storageReachable,
          storageDiagnostic,
          publicNetworkDiagnostic,
          cfConnectingIpPresent,
          encryptionReady,
          transactionalEmailConfigured,
        } = await getAffiliateRecruitmentStatus();
        if (!active || requestId !== latestRequest) return;
        setBackendDiagnostics({
          storage: storageReachable,
          storageDiagnostic,
          publicNetworkDiagnostic,
          ingress: cfConnectingIpPresent,
          encryption: encryptionReady,
          emailConfigured: transactionalEmailConfigured,
        });
        setRecruitment(open ? "open" : "closed");
        if (open) setLiveFormStarted(true);
      } catch {
        // Never assume availability while a status probe is unavailable.
        if (active && requestId === latestRequest) setRecruitment("closed");
      }
    }
    void refreshStatus();
    // Re-check availability without restarting a filled draft.
    const onFocus = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      latestRequest += 1;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const showWizard = preview || recruitment === "open" || liveFormStarted;
  const simulationOnly = preview || recruitment !== "open";

  function requestPreviewExit() {
    if (previewHasDraft) {
      setConfirmPreviewExit(true);
      return;
    }
    finishPreviewExit();
  }

  function finishPreviewExit() {
    setPreview(false);
    setPreviewHasDraft(false);
    setConfirmPreviewExit(false);
  }

  return (
    <AffiliateShell>
      <div className="bg-[#faf6f2] text-[#311f23]">
        <AffiliateLandingIntro recruitmentStatus={recruitment} />

        <section
          id="inscricao"
          data-storage-check={backendDiagnostics.storage ? "ok" : "unavailable"}
          data-storage-diagnostic={backendDiagnostics.storageDiagnostic}
          data-network-diagnostic={backendDiagnostics.publicNetworkDiagnostic}
          data-ingress-check={backendDiagnostics.ingress ? "ok" : "unavailable"}
          data-encryption-check={backendDiagnostics.encryption ? "ok" : "unavailable"}
          data-email-provider={backendDiagnostics.emailConfigured ? "configured" : "unavailable"}
          className="mx-auto max-w-5xl scroll-mt-24 px-5 py-14 sm:py-20"
        >
          <div className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[.24em] text-[#9e565e]">
              {recruitment === "open" ? "Inscrições abertas" : "Programa de afiliados"}
            </p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl">
              Sua inscrição, de um jeito simples.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#765c5d] sm:text-base">
              Só precisamos do seu nome completo, telefone, endereço com CEP e número e dos seus
              perfil no Instagram com seus seguidores. TikTok e seguidores no TikTok são opcionais.
              A inscrição é gratuita e não garante aprovação. Se sua candidatura não for
              selecionada, você poderá se inscrever novamente com o mesmo Instagram. Guarde o código
              de acompanhamento.
            </p>
          </div>

          {!showWizard ? (
            <div
              role="status"
              className="mx-auto max-w-2xl rounded-[2rem] border border-[#e7d4cf] bg-white px-8 py-14 text-center shadow-[0_15px_70px_rgba(80,32,39,.08)]"
            >
              <Sparkles aria-hidden="true" className="mx-auto h-12 w-12 text-[#86535a]" />
              <h3 className="mt-5 font-display text-3xl sm:text-4xl">
                {recruitment === "loading"
                  ? "Verificando inscrições..."
                  : "Inscrições em preparação"}
              </h3>
              <p className="mt-4 leading-relaxed text-[#755b5e]">
                {recruitment === "loading"
                  ? "Estamos verificando a disponibilidade do cadastro."
                  : "O formulário simplificado está disponível para visualização, mas não recebe candidaturas enquanto as inscrições estiverem fechadas."}
              </p>
              {recruitment !== "loading" && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmPreviewExit(false);
                    setPreview(true);
                  }}
                  className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#693440] px-7 py-3 text-sm font-bold text-white hover:bg-[#814d58]"
                >
                  Visualizar formulário (prévia) <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <div className="mt-5">
                <Link to="/" className="text-sm font-semibold text-[#83646a] underline">
                  Voltar à loja
                </Link>
              </div>
            </div>
          ) : (
            <>
              {simulationOnly && (
                <p
                  role="status"
                  className="mx-auto mb-5 max-w-3xl rounded-xl border border-[#eadbd6] bg-white p-4 text-center text-sm text-[#806268]"
                >
                  {preview
                    ? "Esta prévia nunca envia ou armazena candidaturas, mesmo se as inscrições forem abertas."
                    : "A disponibilidade mudou: este cadastro não recebe candidaturas agora. O rascunho permanece nesta aba, mas nenhum envio será realizado."}
                </p>
              )}
              {/* A preview must never turn into a live POST because status changed.
                  Switching explicitly to live starts a fresh form, not an old draft. */}
              <AffiliateSimpleForm
                key={preview ? "preview" : "live"}
                preview={simulationOnly}
                onDraftChange={setPreviewHasDraft}
              />
              {preview && (
                <div className="mt-6 text-center">
                  {confirmPreviewExit ? (
                    <div
                      role="group"
                      aria-label="Confirmar saída da prévia"
                      className="mx-auto max-w-xl rounded-2xl border border-[#e9cec8] bg-white p-6 text-left shadow-sm"
                    >
                      <p className="font-semibold text-[#623b44]">
                        Descartar os dados desta prévia?
                      </p>
                      <p className="mt-2 text-sm text-[#806268]">
                        O rascunho ainda não foi enviado nem armazenado. Para sair, confirme o
                        descarte dos dados digitados.
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="min-h-11 rounded-full bg-[#693440] px-5 text-sm font-semibold text-white"
                          onClick={finishPreviewExit}
                        >
                          {recruitment === "open"
                            ? "Descartar dados e iniciar inscrição real"
                            : "Descartar dados e fechar prévia"}
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-full border border-[#d8bfc2] px-5 text-sm font-semibold text-[#693440]"
                          onClick={() => setConfirmPreviewExit(false)}
                        >
                          Continuar preenchendo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-semibold text-[#8a5962] underline"
                      onClick={requestPreviewExit}
                    >
                      {recruitment === "open"
                        ? "Iniciar inscrição real (novo formulário)"
                        : "Fechar prévia"}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        <AffiliateLandingFAQ />
      </div>
    </AffiliateShell>
  );
}

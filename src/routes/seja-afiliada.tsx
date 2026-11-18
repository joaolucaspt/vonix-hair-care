import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { AffiliateShell } from "@/components/affiliate-shell";
import { getAffiliateRecruitmentStatus } from "@/lib/affiliate-functions";
import { AffiliateSimpleForm } from "@/components/affiliate-simple-form";
import { AffiliateApplicationPrep } from "@/components/affiliate-application-prep";
import { AffiliateNextSteps } from "@/components/affiliate-next-steps";
import { AffiliateLandingIntro, AffiliateLandingFAQ } from "@/components/affiliate-landing";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/store";

export const Route = createFileRoute("/seja-afiliada")({
  head: () => ({
    meta: [
      { title: "Afiliadas Vonix Hair | Criação, candidatura e seleção individual" },
      {
        name: "description",
        content:
          "Conheça o programa de afiliadas Vonix Hair. Candidatura gratuita para maiores de 18 anos, seleção individual e condições para aprovadas, sem garantia de ganhos.",
      },
      { property: "og:title", content: "Afiliadas Vonix Hair | Seu jeito de criar" },
      {
        property: "og:description",
        content:
          "Apresente seu perfil à Vonix Hair. Inscrição gratuita, formulário simples e TikTok opcional. Parceria e benefícios dependem de aprovação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/seja-afiliada" }],
  }),
  component: AffiliateApplicationPage,
});

export function AffiliateApplicationPage() {
  const [recruitment, setRecruitment] = useState<"loading" | "open" | "limited" | "closed">(
    "loading",
  );
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
          intakeEnabled,
          rateLimitReady,
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
        setRecruitment(
          open ? "open" : intakeEnabled === true && rateLimitReady === false ? "limited" : "closed",
        );
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
      <div className="bg-background text-foreground">
        <AffiliateLandingIntro recruitmentStatus={recruitment} />

        <div className="bg-card px-5 pt-14 sm:pt-20">
          <AffiliateApplicationPrep />
        </div>

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
            <p className="text-xs font-bold uppercase tracking-normal text-muted-foreground">
              {recruitment === "open"
                ? "Inscrições abertas"
                : recruitment === "limited"
                  ? "Programa aberto · acesso temporariamente limitado"
                  : "Programa de afiliados"}
            </p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl">
              Sua inscrição, de um jeito simples.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Só precisamos do seu nome completo, telefone, endereço com CEP e número, do seu perfil
              no Instagram e da quantidade de seguidores. E-mail, TikTok e seguidores no TikTok são
              opcionais. A inscrição é gratuita e não garante aprovação. Se sua candidatura não for
              selecionada, você poderá se inscrever novamente com o mesmo Instagram. Guarde o código
              de acompanhamento.
            </p>
          </div>

          {!showWizard ? (
            <div
              role="status"
              className="mx-auto max-w-2xl rounded-lg border border-border bg-card px-8 py-14 text-center shadow-sm"
            >
              <Sparkles aria-hidden="true" className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-5 font-display text-3xl sm:text-4xl">
                {recruitment === "loading"
                  ? "Verificando inscrições..."
                  : recruitment === "limited"
                    ? "Limite temporário nesta conexão"
                    : "Inscrições em preparação"}
              </h3>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                {recruitment === "loading"
                  ? "Estamos verificando a disponibilidade do cadastro."
                  : recruitment === "limited"
                    ? "O programa de afiliadas continua aberto, mas esta conexão não pode enviar novas candidaturas agora. Aguarde alguns minutos e tente novamente; a prévia não registra inscrições."
                    : "O formulário simplificado está disponível para visualização, mas não recebe candidaturas enquanto as inscrições estiverem fechadas."}
              </p>
              {recruitment !== "loading" && (
                <Button
                  type="button"
                  onClick={() => {
                    setConfirmPreviewExit(false);
                    setPreview(true);
                  }}
                  className="h-auto whitespace-normal mt-7 inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-7 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Visualizar formulário (prévia) <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <div className="mt-5">
                <Link
                  to="/"
                  className="h-auto min-h-11 whitespace-normal text-sm font-semibold underline"
                >
                  Voltar à loja
                </Link>
              </div>
            </div>
          ) : (
            <>
              {simulationOnly && (
                <p
                  role="status"
                  className="mx-auto mb-5 max-w-3xl rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground"
                >
                  {preview
                    ? "Esta prévia nunca envia ou armazena candidaturas, mesmo se as inscrições forem abertas."
                    : recruitment === "limited"
                      ? "O programa continua aberto, mas esta conexão está temporariamente limitada. Seu rascunho permanece na aba; o envio não será realizado até o acesso ser restabelecido."
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
                      className="mx-auto max-w-xl rounded-lg border border-border bg-card p-6 text-left shadow-sm"
                    >
                      <p className="font-semibold text-muted-foreground">
                        Descartar os dados desta prévia?
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        O rascunho ainda não foi enviado nem armazenado. Para sair, confirme o
                        descarte dos dados digitados.
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <Button
                          type="button"
                          className="h-auto whitespace-normal min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
                          onClick={finishPreviewExit}
                        >
                          {recruitment === "open"
                            ? "Descartar dados e iniciar inscrição real"
                            : "Descartar dados e fechar prévia"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto whitespace-normal min-h-11 rounded-lg border border-border px-5 text-sm font-semibold text-muted-foreground"
                          onClick={() => setConfirmPreviewExit(false)}
                        >
                          Continuar preenchendo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="h-auto min-h-11 whitespace-normal text-sm font-semibold underline"
                      onClick={requestPreviewExit}
                    >
                      {recruitment === "open"
                        ? "Iniciar inscrição real (novo formulário)"
                        : "Fechar prévia"}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        <AffiliateNextSteps recruitmentOpen={recruitment === "open" && !preview} />
        <AffiliateLandingFAQ />
      </div>
    </AffiliateShell>
  );
}

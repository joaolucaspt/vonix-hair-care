import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { META_PIXEL_ID } from "@/lib/analytics";
import { captureRef } from "@/lib/affiliate-ref";
import { FACEBOOK, INSTAGRAM, SITE_URL } from "@/lib/store";

// IDs lidos do site publicado; confirmar o ID do Clarity em Configurações > Visão geral do projeto.
const GA_ID = "G-JW91EQ32F3";
const CLARITY_ID = "yrgl15vqw9";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-h1 font-semibold text-foreground">404</h1>
        <h2 className="mt-4 text-price font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-body text-muted-foreground">
          A página que você procura não existe ou mudou de endereço.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-body font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-price font-semibold tracking-tight text-foreground">
          Não foi possível carregar a página
        </h1>
        <p className="mt-2 text-body text-muted-foreground">
          Algo deu errado do nosso lado. Tente atualizar ou volte para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-body font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-body font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "facebook-domain-verification", content: "u0im0nkjq23lhwlry3rmvz4ql3cz5z" },
      { title: "Vonix Hair" },
      { name: "description", content: "Cosméticos capilares profissionais Vonix Hair." },
      { property: "og:title", content: "Vonix Hair" },
      { property: "og:description", content: "Cosméticos capilares profissionais Vonix Hair." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "Vonix Hair" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Inter:wght@400;500;600&display=swap" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png?v=3" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon-48.png?v=3" },
      { rel: "shortcut icon", href: "/favicon.ico?v=3" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=3" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Vonix Hair",
              url: SITE_URL,
              logo: `${SITE_URL}/vonix-pedidos-512.png`,
              sameAs: [INSTAGRAM, FACEBOOK],
              contactPoint: { "@type": "ContactPoint", telephone: "+55-31-99008-6296", contactType: "customer service", areaServed: "BR", availableLanguage: "pt-BR" },
            },
            {
              "@type": "WebSite",
              name: "Vonix Hair",
              url: SITE_URL,
              potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/loja?q={search_term_string}`, "query-input": "required name=search_term_string" },
            },
          ],
        }),
      },
      { src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`, async: true },
      {
        children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
      },
      {
        // Clarity só carrega depois da página abrir, para não competir com o conteúdo.
        children: `window.addEventListener('load',function(){setTimeout(function(){(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");},3000)});`,
      },
      {
        // A prévia da Lovable não deve gerar eventos de produção.
        children: `if (window.location.origin === ${JSON.stringify(SITE_URL)} && !window.fbq) {
          !function(f,b,e,v,n,t,s){n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${META_PIXEL_ID}');
          var pvId='PageView-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
          fbq('track','PageView',{},{eventID:pvId});
          setTimeout(function(){try{
            var ck=function(n){var m=document.cookie.split('; ').filter(function(c){return c.indexOf(n+'=')===0})[0];return m?m.slice(n.length+1):undefined};
            var fc=new URLSearchParams(location.search).get('fbclid');
            fetch('/api/public/meta-event',{method:'POST',headers:{'content-type':'application/json'},keepalive:true,
              body:JSON.stringify({event:'PageView',eventId:pvId,url:location.href,fbp:ck('_fbp'),fbc:ck('_fbc')||(fc?'fb.1.'+Date.now()+'.'+fc:undefined)})}).catch(function(){});
          }catch(e){}},1500);
        }`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useLocation({ select: (location) => location.pathname });
  const previousPathname = useRef(pathname);
  // Link de afiliada (?ref=codigo): guarda o código por 30 dias para a venda ser contada para ela.
  useEffect(() => { captureRef(window.location.search); }, []);

  // O script do pixel já registra a primeira página antes da hidratação.
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (window.location.origin === SITE_URL) window.fbq?.("track", "PageView");
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}

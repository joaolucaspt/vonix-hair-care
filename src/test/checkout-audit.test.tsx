import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProduct, lineTotals } from "@/lib/store";
import { savePendingCard } from "@/lib/pending-card";
import { savePendingPix } from "@/lib/pending-pix";

const mocks = vi.hoisted(() => ({
  address: vi.fn(),
  quote: vi.fn(),
  config: vi.fn(),
  payment: vi.fn(),
  status: vi.fn(),
  cart: { lines: [] as unknown[], netSubtotal: 0, subtotal: 0, clear: vi.fn(), add: vi.fn() },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  notFound: vi.fn(),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/site", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SecuritySeal: () => null,
}));
vi.mock("@/components/cart-summary", () => ({ ShippingBar: () => null, Summary: () => null }));
vi.mock("@/components/reviews", () => ({ ProductReviews: () => null, reviewsFor: () => [] }));
vi.mock("@/lib/address.functions", () => ({ lookupAddress: mocks.address }));
vi.mock("@/lib/checkout.functions", () => ({
  quoteShipping: mocks.quote,
  getPaymentConfig: mocks.config,
  createPayment: mocks.payment,
  getOrderStatus: mocks.status,
}));
vi.mock("@/lib/store", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useCart: () => mocks.cart,
  useHydrated: () => true,
}));
import { Route as CheckoutRoute } from "@/routes/checkout";
import { Route as CartRoute } from "@/routes/carrinho";
import { ShippingCalc } from "@/routes/produto.$slug";
const Checkout = (CheckoutRoute as unknown as { options: { component: React.ComponentType } })
  .options.component;
const Cart = (CartRoute as unknown as { options: { component: React.ComponentType } }).options
  .component;
const option = { id: 1, name: "PAC", company: "Correios", price: 0, days: 5, free: true };
const address = {
  ok: true,
  address: { street: "Rua teste", district: "Centro", city: "BH", uf: "MG" },
};
const tick = async () => {
  await waitFor(() => expect(mocks.config).toHaveBeenCalled());
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  const product = getProduct("kit-banana-e-mel");
  if (!product) throw new Error("Produto de teste ausente");
  const variant = product.variants[0];
  mocks.cart.lines = [
    {
      product,
      slug: product.slug,
      variant: variant.label,
      qty: 1,
      price: variant.price,
      ...lineTotals(variant.price, 1),
    },
  ];
  mocks.cart.netSubtotal = variant.price;
  mocks.cart.subtotal = variant.price;
  mocks.address.mockResolvedValue(address);
  mocks.quote.mockResolvedValue({ ok: true, options: [option] });
  mocks.config.mockResolvedValue({
    externalId: "test-only",
    sandbox: true,
    pixEnabled: true,
    cardEnabled: true,
  });
  mocks.payment.mockResolvedValue({ ok: false, message: "Pagamento mockado" });
  window.gtag = vi.fn();
  window.fbq = vi.fn();
  window.clarity = vi.fn();
});
afterEach(() => {
  cleanup();
  delete window.gtag;
  delete window.fbq;
  delete window.clarity;
  delete window.AppmaxScripts;
});
const fillCard = () => {
  for (const [name, value] of [
    ["card-number", "4111 1111 1111 1111"],
    ["card-holder-name", "PESSOA TESTE"],
    ["exp-month", "12"],
    ["exp-year", "2030"],
    ["cvv", "123"],
  ]) {
    const input = document.querySelector<HTMLInputElement>('[name="' + name + '"]');
    if (!input) throw new Error("Campo " + name + " ausente");
    fireEvent.change(input, { target: { value } });
  }
  const cardForm = document.getElementById("card-form") as HTMLFormElement;
  vi.spyOn(cardForm, "requestSubmit").mockImplementation(() => undefined);
  fireEvent.click(screen.getByRole("button", { name: /Pagar .* no cartão/ }));
};
const fill = async () => {
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
  await screen.findByText(/Correios PAC/);
  for (const [label, value] of [
    ["Nome completo", "Pessoa Teste"],
    ["E-mail", "teste@example.com"],
    ["WhatsApp com DDD", "31999999999"],
    ["CPF", "52998224725"],
    ["Número", "10"],
  ] as const)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe("checkout auditado sem chamadas reais", () => {
  it("não permite gerar outro Pix vencido se a Appmax ainda informa pagamento pendente", async () => {
    savePendingPix({
      orderId: 2041,
      statusToken: "signed-read-only-test-token-0000004",
      total: 154.9,
      emv: "pix-test-code",
      qrcode: "dGVzdA==",
      expiresAt: "2025-01-01 12:00:00",
    });
    mocks.status.mockResolvedValue({ ok: true, paid: false, status: "pendente" });
    render(<Checkout />);
    expect(await screen.findByRole("heading", { name: "Pague com Pix" })).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /Verificando o Pix anterior/ });
    expect(retry).toBeDisabled();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("libera novo Pix somente quando a Appmax confirma cancelamento do anterior", async () => {
    savePendingPix({
      orderId: 2042,
      statusToken: "signed-read-only-test-token-0000005",
      total: 154.9,
      emv: "pix-test-code",
      qrcode: "dGVzdA==",
      expiresAt: "2025-01-01 12:00:00",
    });
    mocks.status.mockResolvedValue({ ok: true, paid: false, status: "cancelado" });
    render(<Checkout />);
    const retry = await screen.findByRole("button", { name: "Gerar um novo Pix" });
    expect(retry).toBeEnabled();
    expect(mocks.status).toHaveBeenCalledWith({
      data: { orderId: 2042, statusToken: "signed-read-only-test-token-0000005" },
    });
    fireEvent.click(retry);
    expect(await screen.findByRole("heading", { name: "Finalizar compra" })).toBeInTheDocument();
    expect(sessionStorage.getItem("vonix-pix-verification-v1")).toBeNull();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("recusa armazenada sem confirmação da Appmax não libera outro cartão", async () => {
    savePendingCard({
      orderId: 653,
      statusToken: "signed-read-only-test-token-0000006",
      total: 154.9,
      paid: false,
      status: "recusado_por_risco",
    });
    mocks.status.mockResolvedValue({ ok: true, paid: false, status: "autorizado" });
    render(<Checkout />);
    expect(
      await screen.findByRole("heading", { name: "Pagamento em análise" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(mocks.status).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: /Tentar novamente após a recusa/ }),
    ).not.toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("restaura o Pix pendente na mesma sessão, sem emitir outra cobrança", async () => {
    savePendingPix({
      orderId: 2040,
      statusToken: "signed-read-only-test-token-0000003",
      total: 154.9,
      emv: "pix-test-code",
      qrcode: "dGVzdA==",
      expiresAt: "2027-01-01 12:00:00",
    });
    render(<Checkout />);
    expect(await screen.findByRole("heading", { name: "Pague com Pix" })).toBeInTheDocument();
    expect(screen.getByText(/Pedido nº 2040/)).toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("retoma a mesma análise de cartão após recarregar o checkout, sem nova cobrança", async () => {
    savePendingCard({
      orderId: 655,
      statusToken: "signed-read-only-test-token-0000001",
      total: 154.9,
      paid: false,
      status: "autorizado",
    });
    mocks.status.mockResolvedValue({ ok: true, paid: false, status: "autorizado" });
    render(<Checkout />);
    expect(
      await screen.findByRole("heading", { name: "Pagamento em análise" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.status).toHaveBeenCalledWith({
        data: { orderId: 655, statusToken: "signed-read-only-test-token-0000001" },
      }),
    );
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("libera outra tentativa somente após recusa definitiva confirmada", async () => {
    savePendingCard({
      orderId: 656,
      statusToken: "signed-read-only-test-token-0000002",
      total: 154.9,
      paid: false,
      status: "recusado_por_risco",
    });
    // A client-side status is not enough to unlock another charge: verify with Appmax.
    mocks.status.mockResolvedValue({ ok: true, paid: false, status: "recusado_por_risco" });
    render(<Checkout />);
    expect(
      await screen.findByRole("heading", { name: "Pagamento não aprovado" }),
    ).toBeInTheDocument();
    expect(mocks.status).toHaveBeenCalledWith({
      data: { orderId: 656, statusToken: "signed-read-only-test-token-0000002" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente após a recusa" }));
    expect(await screen.findByRole("heading", { name: "Finalizar compra" })).toBeInTheDocument();
    expect(sessionStorage.getItem("vonix-card-verification-v1")).toBeNull();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("falha ao carregar o script de cartão sem prender o cliente, permite recarregar e preserva Pix", async () => {
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    const getScript = async () => waitFor(() => {
      const script = document.querySelector('script[src*="appmax.min.js"]');
      expect(script).not.toBeNull();
      return script!;
    });
    const script = await getScript();
    expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeDisabled();
    fireEvent.error(script);
    expect(await screen.findByText(/Não foi possível carregar a validação segura do cartão/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeDisabled();
    expect(mocks.payment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Recarregar validação" }));
    window.AppmaxScripts = { init: vi.fn() };
    const retryScript = await getScript();
    fireEvent.load(retryScript);
    await waitFor(() => expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("radio", { name: /Pix/ }));
    expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeEnabled();
  });
  it("script carregado sem API Appmax não habilita cobrança por cartão", async () => {
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    const script = await waitFor(() => {
      const element = document.querySelector('script[src*="appmax.min.js"]');
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.load(script);
    expect(await screen.findByText(/Não foi possível carregar a validação segura do cartão/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeDisabled();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("registra métodos indisponíveis no funil sem dados pessoais", async () => {
    mocks.config.mockResolvedValue({
      externalId: "",
      sandbox: false,
      pixEnabled: false,
      cardEnabled: false,
    });
    render(<Checkout />);
    await waitFor(() =>
      expect(window.gtag).toHaveBeenCalledWith("event", "checkout_error", {
        currency: "BRL",
        step: "payment_config",
        reason: "pix_unavailable",
      }),
    );
    expect(window.gtag).toHaveBeenCalledWith("event", "checkout_error", {
      currency: "BRL",
      step: "payment_config",
      reason: "card_unavailable",
    });
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("não promete aplicar cupom a uma cesta totalmente promocional", async () => {
    const p = getProduct("kit-banana-e-mel")!;
    const v = p.variants[0];
    const t = lineTotals(v.price, 2);
    mocks.cart.lines = [{ product: p, slug: p.slug, variant: v.label, qty: 2, price: v.price, ...t }];
    mocks.cart.netSubtotal = t.net;
    mocks.cart.subtotal = t.gross;
    render(<Checkout />);
    fireEvent.click(screen.getByRole("button", { name: "Tem um cupom?" }));
    fireEvent.change(screen.getByLabelText("Código do cupom"), { target: { value: "BEMVINDA5" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText(/já têm outra promoção/)).toBeInTheDocument();
    expect(screen.queryByText(/Cupom BEMVINDA5 aplicado/)).not.toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("informa economia real do cupom apenas nos itens sem promoção", async () => {
    const p = getProduct("kit-banana-e-mel")!;
    const v = p.variants[0];
    const two = lineTotals(v.price, 2);
    const singleP = getProduct("kit-cafe-verde")!;
    const singleV = singleP.variants[0];
    const one = lineTotals(singleV.price, 1);
    mocks.cart.lines = [
      { product: p, slug: p.slug, variant: v.label, qty: 2, price: v.price, ...two },
      { product: singleP, slug: singleP.slug, variant: singleV.label, qty: 1, price: singleV.price, ...one },
    ];
    mocks.cart.netSubtotal = two.net + one.net;
    mocks.cart.subtotal = two.gross + one.gross;
    render(<Checkout />);
    fireEvent.click(screen.getByRole("button", { name: "Tem um cupom?" }));
    fireEvent.change(screen.getByLabelText("Código do cupom"), { target: { value: "BEMVINDA5" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    const result = await screen.findByText(/Cupom BEMVINDA5 aplicado aos itens elegíveis/);
    expect(result).toHaveTextContent(/você economiza R\$/);
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("não apresenta cobrança por cartão se apenas o Pix estiver habilitado", async () => {
    mocks.config.mockResolvedValue({
      externalId: "",
      sandbox: false,
      pixEnabled: true,
      cardEnabled: false,
    });
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeDisabled();
    expect(screen.getByText(/Estamos ativando os pagamentos desta loja/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Pix/ }));
    expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeEnabled();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("habilita cartão quando só cartão está disponível, sem depender da configuração Pix", async () => {
    mocks.config.mockResolvedValue({
      externalId: "test-only",
      sandbox: true,
      pixEnabled: false,
      cardEnabled: true,
    });
    window.AppmaxScripts = { init: vi.fn() };
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    const sdk = await waitFor(() => {
      const element = document.querySelector('script[src*="appmax.min.js"]');
      expect(element).not.toBeNull();
      return element!;
    });
    expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeDisabled();
    fireEvent.load(sdk);
    await waitFor(() => expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeEnabled());
    expect(screen.getByRole("button", { name: /Pagar .* no cartão/ }).className).toContain("bg-emerald-600");
    fireEvent.click(screen.getByRole("radio", { name: /Pix/ }));
    expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeDisabled();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("cartão e resumo precedem CTA; formulários separados, atributos e 6 parcelas preservados", async () => {
    const { container } = render(<Checkout />);
    await tick();
    await fill();
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    const card = container.querySelector("#card-form");
    if (!card) throw new Error("Formulário de cartão ausente");
    const cta = screen.getByRole("button", { name: /Pagar .* no cartão/ });
    expect(card.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getByTestId("summary").compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelector("form form")).toBeNull();
    expect(card).toHaveAttribute("data-appmax-checkout");
    for (const name of ["card-number", "card-holder-name", "exp-month", "exp-year", "cvv"])
      expect(container.querySelector(`[name="${name}"]`)).toHaveAttribute("form", "card-form");
    expect(screen.getByLabelText("Parcelas").querySelectorAll("option")).toHaveLength(6);
    expect(cta).toHaveAttribute("form", "checkout-form");
    fireEvent.click(cta);
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("Pix não valida cartão oculto e mantém envio Pix e CPF", async () => {
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    await waitFor(() => expect(mocks.payment).toHaveBeenCalledTimes(1));
    expect(mocks.payment.mock.calls[0]?.[0].data.method).toBe("pix");
    expect(mocks.payment.mock.calls[0]?.[0].data.token).toBeUndefined();
    expect(mocks.payment.mock.calls[0]?.[0].data.customer.cpf).toBe("529.982.247-25");
  });
  it("CPF inválido não envia pagamento", async () => {
    render(<Checkout />);
    await fill();
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "11111111111" } });
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(await screen.findByText("CPF inválido. Confira os números.")).toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("não libera cobrança com cotação vazia ou sem transportadora válida", async () => {
    mocks.quote.mockResolvedValue({ ok: true, options: [] });
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    expect(await screen.findByText(/Não encontramos entrega disponível/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeDisabled();
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("frete funciona sem endereço; dados manuais permitem continuar", async () => {
    mocks.address.mockRejectedValue(new Error("timeout"));
    render(<Checkout />);
    await fill();
    for (const [label, value] of [
      ["Rua", "Rua manual"],
      ["Bairro", "Centro"],
      ["Cidade", "BH"],
      ["UF", "MG"],
    ] as const)
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeEnabled();
    expect(await screen.findByText(/Preencha manualmente; o frete/)).toBeInTheDocument();
  });
  it("ignora endereço atrasado após trocar CEP e remove frete de CEP incompleto", async () => {
    let resolveOld: (result: unknown) => void = () => {};
    mocks.address.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    await waitFor(() => expect(mocks.address).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310100" } });
    await waitFor(() => expect(screen.getByLabelText("Cidade")).toHaveValue("BH"));
    resolveOld({ ok: true, address: { ...address.address, city: "OLD" } });
    await waitFor(() => expect(screen.getByLabelText("Cidade")).toHaveValue("BH"));
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310" } });
    expect(screen.queryByText(/Correios PAC/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeDisabled();
  });
  it("não promete frete grátis no produto quando nenhuma transportadora atende o CEP", async () => {
    mocks.quote.mockResolvedValueOnce({ ok: true, options: [] });
    render(<ShippingCalc subtotal={200} slug="kit-banana-e-mel" variant="Kit" qty={1} />);
    fireEvent.change(screen.getByLabelText("CEP de entrega"), { target: { value: "30140010" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(await screen.findByText(/Não há opções de entrega para este CEP/)).toBeInTheDocument();
    expect(screen.queryByText(/Frete Grátis — pedido acima/)).not.toBeInTheDocument();
  });
  it("produto exibe estimativa mesmo quando endereço falha", async () => {
    mocks.address.mockRejectedValue(new Error("network"));
    render(<ShippingCalc subtotal={154.9} slug="kit-banana-e-mel" variant="Kit" qty={1} />);
    fireEvent.change(screen.getByLabelText("CEP de entrega"), { target: { value: "69005070" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(await screen.findByText(/Estimativa de frete/)).toBeInTheDocument();
    expect(screen.getByText("Correios PAC")).toBeInTheDocument();
    expect(mocks.quote).toHaveBeenCalledTimes(1);
  });
  it("ignora dois callbacks de tokenização simultâneos sem criar duas cobranças", async () => {
    let onTokenize: ((value: { token: string }) => void) | undefined;
    window.AppmaxScripts = {
      init: ({ onTokenize: handler }) => {
        onTokenize = handler;
      },
    };
    let resolvePayment: ((value: unknown) => void) | undefined;
    mocks.payment.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePayment = resolve;
        }),
    );
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    const script = await waitFor(() => {
      const element = document.querySelector('script[src*="appmax.min.js"]');
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.load(script);
    expect(onTokenize).toBeDefined();
    onTokenize?.({ token: "unsolicited" });
    expect(mocks.payment).not.toHaveBeenCalled();
    fillCard();
    await act(async () => {
      onTokenize?.({ token: "test-token" });
      onTokenize?.({ token: "test-token" });
      await Promise.resolve();
    });
    expect(mocks.payment).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePayment?.({ ok: false, message: "Erro simulado de gateway" });
      await Promise.resolve();
    });
  });
  it("cartão em análise fica em acompanhamento, sem sugerir uma segunda cobrança", async () => {
    let onTokenize: ((value: { token: string }) => void) | undefined;
    window.AppmaxScripts = {
      init: ({ onTokenize: handler }) => {
        onTokenize = handler;
      },
    };
    mocks.payment.mockResolvedValueOnce({
      ok: true,
      method: "card",
      orderId: 654,
      statusToken: "signed-test-only",
      total: 154.9,
      paid: false,
      status: "autorizado",
    });
    mocks.status.mockResolvedValue({ ok: true, paid: false, status: "autorizado" });
    const gtag = window.gtag;
    if (!gtag) throw new Error("Analytics mock ausente");
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    const script = await waitFor(() => {
      const element = document.querySelector('script[src*="appmax.min.js"]');
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.load(script);
    expect(onTokenize).toBeDefined();
    fillCard();
    await act(async () => {
      onTokenize?.({ token: "token-test" });
    });
    expect(
      await screen.findByRole("heading", { name: "Pagamento em análise" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Não efetue outro pagamento/)).toBeInTheDocument();
    expect(screen.queryByText(/tente outro cartão/)).not.toBeInTheDocument();
    expect(mocks.payment).toHaveBeenCalledTimes(1);
    expect(vi.mocked(gtag).mock.calls.filter((call) => call[1] === "purchase")).toHaveLength(0);
  });
  it("registra a compra uma única vez após a Appmax confirmar cartão antes em análise", async () => {
    let onTokenize: ((value: { token: string }) => void) | undefined;
    window.AppmaxScripts = {
      init: ({ onTokenize: handler }) => {
        onTokenize = handler;
      },
    };
    mocks.payment.mockResolvedValueOnce({
      ok: true,
      method: "card",
      orderId: 655,
      statusToken: "signed-test-only",
      total: 154.9,
      paid: false,
      status: "autorizado",
    });
    mocks.status.mockResolvedValue({ ok: true, paid: true, status: "aprovado" });
    const gtag = window.gtag;
    if (!gtag) throw new Error("Analytics mock ausente");
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    const script = await waitFor(() => {
      const element = document.querySelector('script[src*="appmax.min.js"]');
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.load(script);
    fillCard();
    await act(async () => {
      onTokenize?.({ token: "test-token" });
    });
    expect(await screen.findByRole("heading", { name: "Pagamento aprovado!" })).toBeInTheDocument();
    expect(mocks.status).toHaveBeenCalledWith({
      data: { orderId: 655, statusToken: "signed-test-only" },
    });
    expect(mocks.cart.clear).toHaveBeenCalledTimes(1);
    expect(vi.mocked(gtag).mock.calls.filter((call) => call[1] === "purchase")).toHaveLength(1);
  });
  it("view_cart e add_shipping_info sem duplicatas ou dados pessoais", async () => {
    const gtag = window.gtag;
    const fbq = window.fbq;
    if (!gtag || !fbq) throw new Error("Mocks de eventos ausentes");
    const cart = render(<Cart />);
    cart.rerender(<Cart />);
    expect(vi.mocked(gtag).mock.calls.filter((c) => c[1] === "view_cart")).toHaveLength(1);
    cart.unmount();
    const checkout = render(<Checkout />);
    await fill();
    checkout.rerender(<Checkout />);
    const events = vi.mocked(gtag).mock.calls.filter((c) => c[1] === "add_shipping_info");
    expect(events).toHaveLength(1);
    expect(events[0]?.[2]).toMatchObject({
      shipping_tier: "Correios PAC",
      currency: "BRL",
      value: 169.9,
    });
    expect(Object.keys(events[0]?.[2] as object).sort()).toEqual([
      "currency",
      "items",
      "shipping_tier",
      "value",
    ]);
    expect(vi.mocked(fbq).mock.calls.some((c) => c[1] === "Purchase")).toBe(false);
  });
});

describe("complemento do carrinho", () => {
  it("registra AddToCart com o desconto realmente aplicado ao item", () => {
    render(<Cart />);
    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar" })[0]!);
    expect(mocks.cart.add).toHaveBeenCalledTimes(1);
    const [slug, variant, qty, offer] = mocks.cart.add.mock.calls[0]!;
    expect(qty).toBe(1);
    expect(offer).toBe("comp5");

    const product = getProduct(slug);
    const selectedVariant = product?.variants.find((v) => v.label === variant);
    expect(selectedVariant).toBeDefined();
    const expectedPrice = lineTotals(selectedVariant!.price, 1, "comp5").net;
    const gtag = window.gtag;
    if (!gtag) throw new Error("Mock de analytics ausente");
    const addEvents = vi.mocked(gtag).mock.calls.filter((call) => call[1] === "add_to_cart");
    expect(addEvents).toHaveLength(1);
    expect(addEvents[0]?.[2]).toMatchObject({
      currency: "BRL",
      value: expectedPrice,
      items: [{ item_id: expect.any(String), price: expectedPrice, quantity: 1 }],
    });
  });
});

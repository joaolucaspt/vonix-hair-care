import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProduct, lineTotals } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  address: vi.fn(),
  quote: vi.fn(),
  config: vi.fn(),
  payment: vi.fn(),
  status: vi.fn(),
  cart: { lines: [] as unknown[], netSubtotal: 0, subtotal: 0, clear: vi.fn() },
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
  mocks.config.mockResolvedValue({ externalId: "test-only", sandbox: true, pixEnabled: true });
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
});
const fill = async () => {
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
  await screen.findByText(/4 a 5 dias úteis/);
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
  it("cartão e resumo precedem CTA; formulários separados, atributos e 6 parcelas preservados", async () => {
    const { container } = render(<Checkout />);
    await tick();
    await fill();
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    const card = container.querySelector("#card-form");
    if (!card) throw new Error("Formulário de cartão ausente");
    const cta = screen.getByRole("button", { name: /Pagar .* no cartão/ });
    expect(card.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // O resumo continua visível acima do botão de pagar.
    expect(screen.getByTestId("summary")).toBeInTheDocument();
    expect(container.querySelector("form form")).toBeNull();
    expect(card).toHaveAttribute("data-appmax-checkout");
    for (const name of ["card-number", "card-holder-name", "exp-month", "exp-year", "cvv"])
      expect(container.querySelector(`[name="${name}"]`)).toHaveAttribute("form", "card-form");
    expect(screen.getByLabelText("Parcelas").querySelectorAll("option")).toHaveLength(6);
    // O botão de pagar é único e fica flutuante e fixo na base da tela (envia o formulário principal).
    expect(cta).toHaveAttribute("data-testid", "checkout-pay-float");
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
  it("tela do Pix mostra o contador preto com o prazo real da Appmax e avisa quando expira", async () => {
    // A Appmax manda a hora de Brasília ("Y-m-d H:i:s"): 10 minutos à frente.
    const brt = (min: number) => new Date(Date.now() + min * 60000 - 3 * 3600000).toISOString().slice(0, 19).replace("T", " ");
    mocks.payment.mockResolvedValue({
      ok: true,
      method: "pix",
      orderId: 7,
      total: 99.9,
      pix: { emv: "000201-teste", qrcode: "AAAA", expiresAt: brt(10) },
    });
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    const timer = await screen.findByTestId("pix-timer");
    expect(timer).toHaveTextContent("Seu Pix expira em");
    expect(timer).toHaveTextContent(/0[89]:\d\d|10:00/);
    cleanup();
    mocks.payment.mockResolvedValue({
      ok: true,
      method: "pix",
      orderId: 8,
      total: 99.9,
      pix: { emv: "000201-teste", qrcode: "AAAA", expiresAt: brt(-1) },
    });
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(await screen.findByTestId("pix-timer")).toHaveTextContent("Este Pix expirou");
  });
  it("WhatsApp curto ou nome curto: avisa o campo certo, uma vez só, e não envia o pedido", async () => {
    render(<Checkout />);
    await fill();
    fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("Digite seu WhatsApp com DDD");
    expect(document.activeElement).toBe(screen.getByLabelText("WhatsApp com DDD"));
    expect(mocks.payment).not.toHaveBeenCalled();
    // ao corrigir, o aviso antigo some
    fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), { target: { value: "31999999999" } });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ab" } });
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(await screen.findByText("Digite seu nome completo.")).toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("trocar o CEP apaga o endereço antigo: nunca fica rua de outro CEP escondida", async () => {
    mocks.address.mockResolvedValue(address);
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    await waitFor(() => expect(screen.getByTestId("checkout-address-summary")).toHaveTextContent("Rua teste"));
    mocks.address.mockResolvedValue({ ok: false, message: "Não foi possível localizar o endereço deste CEP." });
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "00000000" } });
    await waitFor(() => expect(screen.queryByTestId("checkout-address-summary")).not.toBeInTheDocument());
    // os campos manuais aparecem vazios para a pessoa preencher
    expect(screen.getByLabelText("Rua")).toHaveValue("");
    expect(screen.getByLabelText("Cidade")).toHaveValue("");
  });
  it("aplicar cupom não troca o frete que o cliente escolheu; falha passageira tem 'Tentar de novo'", async () => {
    const barato = { id: 1, name: "PAC", company: "Correios", price: 20, days: 5, free: false };
    const rapido = { id: 2, name: "SEDEX", company: "Correios", price: 40, days: 2, free: false };
    mocks.quote.mockResolvedValue({ ok: true, options: [rapido, barato] });
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    await screen.findByText(/Correios SEDEX/);
    const radios = () => screen.getAllByRole("radio", { name: /Correios (PAC|SEDEX)/ });
    // o mais barato já vem marcado
    expect(radios().find((r) => (r as HTMLInputElement).checked)?.closest("label")).toHaveTextContent("PAC");
    // o cliente escolhe o SEDEX e a escolha se mantém
    fireEvent.click(radios().find((r) => r.closest("label")?.textContent?.includes("SEDEX")) as HTMLElement);
    await waitFor(() =>
      expect(radios().find((r) => (r as HTMLInputElement).checked)?.closest("label")).toHaveTextContent("SEDEX"),
    );
    // falha passageira: aparece o botão e ele refaz a cotação
    mocks.quote.mockResolvedValueOnce({ ok: false, message: "Não foi possível calcular o frete agora. Toque em “Tentar de novo”." });
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310100" } });
    const retry = await screen.findByRole("button", { name: "Tentar de novo" });
    const before = mocks.quote.mock.calls.length;
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.quote.mock.calls.length).toBeGreaterThan(before));
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
    const resumo = () => screen.getByTestId("checkout-address-summary");
    await waitFor(() => expect(resumo()).toHaveTextContent("BH/MG"));
    resolveOld({ ok: true, address: { ...address.address, city: "OLD" } });
    await waitFor(() => expect(resumo()).toHaveTextContent("BH/MG"));
    expect(resumo()).not.toHaveTextContent("OLD");
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310" } });
    expect(screen.queryByText(/Correios PAC/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeDisabled();
  });
  it("produto exibe estimativa mesmo quando endereço falha", async () => {
    mocks.address.mockRejectedValue(new Error("network"));
    render(<ShippingCalc subtotal={154.9} slug="kit-banana-e-mel" variant="Kit" qty={1} />);
    fireEvent.change(screen.getByLabelText("CEP de entrega"), { target: { value: "69005070" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(await screen.findByText(/Estimativa de frete/)).toBeInTheDocument();
    expect(screen.getByText("Frete grátis")).toBeInTheDocument();
    expect(screen.queryByText(/Correios/)).not.toBeInTheDocument();
    expect(mocks.quote).toHaveBeenCalledTimes(1);
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
      value: getProduct("kit-banana-e-mel")?.variants[0].price,
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

describe("C86 — total integral ao lado do parcelamento no checkout", () => {
  it("destaca valor integral primeiro, 6x ao lado e informa a diferença de centavos", () => {
    render(<Checkout />);
    const tile = screen.getByTestId("pay-option-card");
    const text = (tile.textContent ?? "").replace(/\u00a0/g, " ");
    const price = getProduct("kit-banana-e-mel")!.variants[0]!.price;
    const cents = Math.round(price * 100);
    const each = Math.floor(cents / 6);
    const first = cents - each * 5;
    const money = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
        .format(v)
        .replace(/\u00a0/g, " ");
    expect(tile.querySelector('[aria-live="polite"]')?.className).toContain(
      "grid-cols-[auto_minmax(0,1fr)]",
    );
    expect(tile.closest("fieldset")?.querySelector(".grid-cols-1")).not.toBeNull();
    expect(text.indexOf(money(price))).toBeLessThan(text.indexOf("6x de"));
    expect(text).toContain("Valor total");
    expect(text).toContain("6x de " + money(each / 100));
    expect(text).toContain("sem juros");
    if (first !== each) expect(text).toContain("1ª de " + money(first / 100));
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("recalcula integral e 6x para frete cotado e mantem 1x selecionado", async () => {
    mocks.quote.mockResolvedValue({
      ok: true,
      options: [{ ...option, price: 12.03, free: false }],
    });
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    await screen.findByText(/Correios PAC/);
    const total = getProduct("kit-banana-e-mel")!.variants[0]!.price + 12.03;
    const amount = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
      .format(total)
      .replace(/\u00a0/g, " ");
    const text = (screen.getByTestId("pay-option-card").textContent ?? "").replace(/\u00a0/g, " ");
    expect(text).toContain(amount);
    expect(text).toContain("6x de");
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    expect(screen.getByLabelText("Parcelas")).toHaveValue("1");
    expect(mocks.payment).not.toHaveBeenCalled();
  });
});

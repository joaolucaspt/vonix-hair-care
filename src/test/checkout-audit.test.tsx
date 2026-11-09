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
  it("produto exibe estimativa mesmo quando endereço falha", async () => {
    mocks.address.mockRejectedValue(new Error("network"));
    render(<ShippingCalc subtotal={154.9} slug="kit-banana-e-mel" variant="Kit" qty={1} />);
    fireEvent.change(screen.getByLabelText("CEP de entrega"), { target: { value: "69005070" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(await screen.findByText(/Estimativa de frete/)).toBeInTheDocument();
    expect(screen.getByText("Correios PAC")).toBeInTheDocument();
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
      value: 154.9,
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

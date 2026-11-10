import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brl, getProduct, lineTotals } from "@/lib/store";
import { savePendingCard } from "@/lib/pending-card";
import { savePendingPix } from "@/lib/pending-pix";
import { savePurchaseBasket, restorePurchaseBasket } from "@/lib/pending-purchase-basket";
import { UNCERTAIN_PAYMENT_KEY } from "@/lib/uncertain-payment";
import { TRACKING_CONSENT_KEY } from "@/lib/tracking-consent";
import { captureRef } from "@/lib/affiliate-ref";

const mocks = vi.hoisted(() => ({
  address: vi.fn(),
  quote: vi.fn(),
  config: vi.fn(),
  couponLookup: vi.fn(),
  payment: vi.fn(),
  status: vi.fn(),
  cart: { lines: [] as unknown[], netSubtotal: 0, subtotal: 0, clear: vi.fn(), add: vi.fn() },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
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
  lookupCoupon: mocks.couponLookup,
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
  localStorage.setItem(TRACKING_CONSENT_KEY, "accepted");
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
  mocks.couponLookup.mockResolvedValue({ ok: false });
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
  it("CEP válido sem rua/bairro informa preenchimento parcial e direciona ao primeiro campo ausente", async () => {
    mocks.address.mockResolvedValueOnce({
      ok: true,
      address: { street: "", district: "", city: "Belo Horizonte", uf: "MG" },
    });
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    expect(
      await screen.findByText(/CEP localizado.*preencha rua, bairro e número/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Rua")).toHaveValue("");
    expect(screen.getByLabelText("Bairro")).toHaveValue("");
    expect(screen.getByLabelText("Cidade")).toHaveValue("Belo Horizonte");
    expect(screen.getByLabelText("Rua")).toHaveFocus();
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("impede pagamento com nome composto apenas por espaços e informa como corrigir", async () => {
    render(<Checkout />);
    await fill();
    await waitFor(() => expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "   " } });
    fireEvent.submit(document.getElementById("checkout-form")!);
    expect(mocks.payment).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/nome completo válido/i);
  });

  it("não envia Pix com WhatsApp brasileiro malformado ou DDD inexistente", async () => {
    render(<Checkout />);
    await fill();
    await waitFor(() => expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), {
      target: { value: "00000000000" },
    });
    fireEvent.submit(document.getElementById("checkout-form")!);
    expect(mocks.payment).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/WhatsApp.*DDD.*válido/i);
  });

  it("não envia pagamento com rua, número, bairro ou cidade só com espaços", async () => {
    render(<Checkout />);
    await fill();
    await waitFor(() => expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Rua"), { target: { value: "   " } });
    fireEvent.submit(document.getElementById("checkout-form")!);
    expect(mocks.payment).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/endereço de entrega/i);
  });

  it("não envia pagamento com UF que não seja estado brasileiro", async () => {
    render(<Checkout />);
    await fill();
    await waitFor(() => expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("UF"), { target: { value: "XX" } });
    fireEvent.submit(document.getElementById("checkout-form")!);
    expect(mocks.payment).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/UF válida/i);
  });

  it("não libera dados pessoais nem pagamento enquanto a configuração ainda não respondeu", () => {
    mocks.config.mockReturnValueOnce(new Promise(() => undefined));
    render(<Checkout />);
    expect(screen.getByRole("status")).toHaveTextContent(/Verificando as formas de pagamento/);
    const form = document.getElementById("checkout-form");
    expect(form).toHaveAttribute("inert");
    expect(form).toHaveAttribute("aria-busy", "true");
    fireEvent.submit(form!);
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("recupera uma consulta de pagamento com erro sem criar pedidos e sem reaplicar cupons", async () => {
    mocks.config.mockRejectedValueOnce(new Error("Falha sintética de configuração"));
    render(<Checkout />);
    expect(
      await screen.findByRole("heading", {
        name: "Não foi possível verificar as formas de pagamento",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("CPF")).not.toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar consultar novamente" }));
    await waitFor(() => expect(mocks.config).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(document.getElementById("checkout-form")).not.toHaveAttribute("inert"),
    );
    expect(screen.getByLabelText("CPF")).toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("expira a consulta travada em 12 segundos sem liberar pagamento ou perder a sacola", () => {
    vi.useFakeTimers();
    try {
      mocks.config.mockReturnValueOnce(new Promise(() => undefined));
      render(<Checkout />);
      const form = document.getElementById("checkout-form");
      expect(form).toHaveAttribute("inert");
      act(() => vi.advanceTimersByTime(12000));
      expect(
        screen.getByRole("heading", {
          name: "Não foi possível verificar as formas de pagamento",
        }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("CPF")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Tentar consultar novamente" })).toBeEnabled();
      expect(mocks.payment).not.toHaveBeenCalled();
      expect(mocks.cart.clear).not.toHaveBeenCalled();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("encerra cotação travada em 15 segundos e ignora resposta tardia, sem cobrança", async () => {
    let resolveQuote: (value: { ok: true; options: (typeof option)[] }) => void = () => undefined;
    mocks.quote.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveQuote = resolve;
        }),
    );
    try {
      render(<Checkout />);
      // Finish the independent payment-readiness request first, so fake time
      // tests only the shipping watchdog, not the gateway watchdog.
      await waitFor(() =>
        expect(document.getElementById("checkout-form")).not.toHaveAttribute("inert"),
      );
      vi.useFakeTimers();
      fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
      expect(screen.getByText(/Calculando frete/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeDisabled();
      await act(async () => vi.advanceTimersByTime(15000));
      expect(screen.getByRole("alert", { name: "" })).toHaveTextContent(
        "O cálculo de frete demorou demais. Tente calcular novamente.",
      );
      expect(screen.getByRole("button", { name: "Tentar calcular frete novamente" })).toBeEnabled();
      expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeDisabled();
      await act(async () => resolveQuote({ ok: true, options: [option] }));
      expect(screen.queryByText(/Correios PAC/)).not.toBeInTheDocument();
      fireEvent.submit(document.getElementById("checkout-form")!);
      expect(mocks.payment).not.toHaveBeenCalled();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("recota depois do timeout e não aceita a primeira resposta atrasada", async () => {
    let resolveOldQuote: (value: { ok: true; options: (typeof option)[] }) => void = () =>
      undefined;
    mocks.quote
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldQuote = resolve;
          }),
      )
      .mockResolvedValueOnce({ ok: true, options: [option] });
    try {
      render(<Checkout />);
      await waitFor(() =>
        expect(document.getElementById("checkout-form")).not.toHaveAttribute("inert"),
      );
      vi.useFakeTimers();
      fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
      await act(async () => {
        vi.advanceTimersByTime(15000);
      });
      expect(screen.getByText(/O cálculo de frete demorou demais/)).toBeInTheDocument();
      await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: "Tentar calcular frete novamente" })),
      );
      expect(screen.getByText(/Correios PAC/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeEnabled();
      await act(async () =>
        resolveOldQuote({
          ok: true,
          options: [{ ...option, id: 999, name: "Frete obsoleto", price: 99 }],
        }),
      );
      expect(screen.queryByText(/Frete obsoleto/)).not.toBeInTheDocument();
      expect(screen.getByText(/Correios PAC/)).toBeInTheDocument();
      expect(mocks.payment).not.toHaveBeenCalled();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("configuração atrasada após timeout não libera dados pessoais sem nova consulta", async () => {
    vi.useFakeTimers();
    let resolveConfig: (value: {
      externalId: string;
      sandbox: boolean;
      pixEnabled: boolean;
      cardEnabled: boolean;
    }) => void = () => undefined;
    mocks.config.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveConfig = resolve;
        }),
    );
    try {
      render(<Checkout />);
      await act(async () => vi.advanceTimersByTime(12000));
      expect(
        screen.getByRole("heading", {
          name: "Não foi possível verificar as formas de pagamento",
        }),
      ).toBeInTheDocument();
      await act(async () =>
        resolveConfig({
          externalId: "synthetic-test-only",
          sandbox: true,
          pixEnabled: true,
          cardEnabled: true,
        }),
      );
      expect(screen.queryByLabelText("CPF")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Tentar consultar novamente" })).toBeEnabled();
      expect(mocks.payment).not.toHaveBeenCalled();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("não conserva o endereço nem o número da entrega anterior quando o CEP muda", async () => {
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    await waitFor(() => expect(screen.getByLabelText("Rua")).toHaveValue("Rua teste"));
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "57" } });
    fireEvent.change(screen.getByLabelText("Complemento"), { target: { value: "Apto 12" } });
    mocks.address.mockReturnValueOnce(new Promise(() => undefined));
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140011" } });
    expect(screen.getByLabelText("Rua")).toHaveValue("");
    expect(screen.getByLabelText("Bairro")).toHaveValue("");
    expect(screen.getByLabelText("Cidade")).toHaveValue("");
    expect(screen.getByLabelText("UF")).toHaveValue("");
    expect(screen.getByLabelText("Número")).toHaveValue("");
    expect(screen.getByLabelText("Complemento")).toHaveValue("");
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("não sobrescreve rua digitada manualmente enquanto a consulta do CEP está pendente", async () => {
    let resolveAddress: (value: typeof address) => void = () => undefined;
    mocks.address.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAddress = resolve;
        }),
    );
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    fireEvent.change(screen.getByLabelText("Rua"), { target: { value: "Rua correta, digitada" } });
    await act(async () => resolveAddress(address));
    expect(screen.getByLabelText("Rua")).toHaveValue("Rua correta, digitada");
    expect(screen.getByLabelText("Bairro")).toHaveValue("Centro");
    expect(screen.getByLabelText("Cidade")).toHaveValue("BH");
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("encerra consulta de CEP travada em 10 segundos e permite preencher endereço manualmente", async () => {
    mocks.address.mockImplementationOnce(() => new Promise(() => undefined));
    render(<Checkout />);
    await waitFor(() =>
      expect(document.getElementById("checkout-form")).not.toHaveAttribute("inert"),
    );
    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
      expect(screen.getByText(/Buscando endereço/)).toBeInTheDocument();
      await act(async () => vi.advanceTimersByTime(10000));
      expect(screen.queryByText(/Buscando endereço/)).not.toBeInTheDocument();
      expect(
        screen.getByText(/Não foi possível confirmar o endereço pelo CEP/),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Rua")).toBeEnabled();
      fireEvent.change(screen.getByLabelText("Rua"), {
        target: { value: "Rua informada manualmente" },
      });
      expect(screen.getByLabelText("Rua")).toHaveValue("Rua informada manualmente");
      mocks.address.mockResolvedValueOnce(address);
      expect(screen.getByRole("button", { name: "Tentar buscar CEP novamente" })).toBeEnabled();
      await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: "Tentar buscar CEP novamente" })),
      );
      expect(mocks.address).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText("Rua")).toHaveValue("Rua informada manualmente");
      expect(screen.getByLabelText("Bairro")).toHaveValue("Centro");
      expect(
        screen.queryByRole("button", { name: "Tentar buscar CEP novamente" }),
      ).not.toBeInTheDocument();
      expect(mocks.payment).not.toHaveBeenCalled();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it("erro de frete mantém botão fora do parágrafo de alerta para HTML e hidratação válidos", async () => {
    mocks.quote.mockResolvedValueOnce({
      ok: false,
      message: "Transportadora temporariamente indisponível",
    });
    const { container } = render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    expect(
      await screen.findByText("Transportadora temporariamente indisponível"),
    ).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert.tagName).toBe("P");
    expect(alert.querySelector("button")).toBeNull();
    const retry = screen.getByRole("button", { name: "Tentar calcular frete novamente" });
    expect(alert.parentElement).toContainElement(retry);
    expect(container.querySelector("p button")).toBeNull();
  });

  it("reapresenta o catálogo e os kits quando o carrinho está vazio, sem permitir checkout", () => {
    mocks.cart.lines = [];
    mocks.cart.netSubtotal = 0;
    mocks.cart.subtotal = 0;
    render(<Cart />);
    expect(screen.getByRole("heading", { name: "Sua sacola está vazia" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar produtos" })).toHaveAttribute(
      "href",
      "/loja",
    );
    expect(screen.getByRole("link", { name: "Explorar kits" })).toHaveAttribute("href", "/loja");
    expect(screen.queryByRole("link", { name: "Finalizar minha compra" })).not.toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("mostra subtotal de produtos no CTA fixo do carrinho móvel sem anunciar frete fechado", () => {
    render(<Cart />);
    const sticky = screen.getByRole("region", { name: "Resumo do carrinho no celular" });
    expect(sticky).toHaveTextContent("Produtos, sem frete");
    expect(sticky.textContent?.replace(/\s/g, " ")).toContain(
      brl(mocks.cart.netSubtotal).replace(/\s/g, " "),
    );
    expect(sticky).toContainElement(
      screen.getAllByRole("link", { name: "Finalizar minha compra" }).at(-1)!,
    );
    expect(sticky).not.toHaveTextContent("Total final");
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("CPF recusado destaca o campo correspondente sem chamar pagamento", async () => {
    render(<Checkout />);
    await fill();
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "00000000000" } });
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(screen.getByText("CPF inválido. Confira os números.")).toBeInTheDocument();
    expect(screen.getByLabelText("CPF")).toHaveFocus();
    expect(screen.getByLabelText("CPF")).toHaveAttribute("aria-invalid", "true");
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("mostra total atualizado e acesso para editar sacola no começo do checkout em telas pequenas", async () => {
    render(<Checkout />);
    expect(screen.getByText("Resumo rápido da compra")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /editar sacola/i })).toHaveAttribute(
      "href",
      "/carrinho",
    );
    expect(screen.getByText(/frete calculado pelo CEP/i)).toBeInTheDocument();
  });

  it("resumo rápido acompanha cotação e método sem prometer frete antecipadamente", async () => {
    render(<Checkout />);
    const quick = screen.getByText("Resumo rápido da compra").parentElement?.parentElement;
    expect(quick?.textContent).toContain("Frete calculado pelo CEP");
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    await screen.findByText(/Correios PAC/);
    await waitFor(() => expect(quick?.textContent).toContain("Frete grátis cotado"));
    const before = quick?.querySelector("b")?.textContent;
    fireEvent.click(screen.getByRole("radio", { name: /Cartão de crédito/ }));
    const after = quick?.querySelector("b")?.textContent;
    expect(after).not.toBe(before);
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("refaz a cotação após total alterado sem repetir pagamento", async () => {
    mocks.payment.mockResolvedValueOnce({
      ok: false,
      retrySafe: true,
      reason: "price_changed",
      message: "O total da compra mudou desde a cotação.",
    });
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(await screen.findByText("O total da compra mudou desde a cotação.")).toBeInTheDocument();
    await waitFor(() => expect(mocks.quote).toHaveBeenCalledTimes(2));
    expect(mocks.payment).toHaveBeenCalledTimes(1);
  });
  it("invalida o frete antigo imediatamente ao mudar o CEP, antes da resposta seguinte", async () => {
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    await screen.findByText(/Correios PAC/);
    const pay = screen.getByRole("button", { name: /Gerar Pix/ });
    await waitFor(() => expect(pay).toBeEnabled());
    mocks.quote.mockReturnValueOnce(new Promise(() => undefined));
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140011" } });
    expect(pay).toBeDisabled();
    expect(screen.queryByText(/Correios PAC/)).not.toBeInTheDocument();
    fireEvent.submit(document.getElementById("checkout-form")!);
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("ao alterar itens da sacola, rejeita cotação da cesta anterior sem cobrar", async () => {
    const view = render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    await screen.findByText(/Correios PAC/);
    const pay = screen.getByRole("button", { name: /Gerar Pix/ });
    await waitFor(() => expect(pay).toBeEnabled());
    mocks.quote.mockReturnValueOnce(new Promise(() => undefined));
    const item = mocks.cart.lines[0] as { qty: number; net: number; gross: number; units: number };
    item.qty = 2;
    item.units = 2;
    item.net = 339.8;
    item.gross = 339.8;
    mocks.cart.netSubtotal = 339.8;
    mocks.cart.subtotal = 339.8;
    view.rerender(<Checkout />);
    expect(pay).toBeDisabled();
    expect(screen.queryByText(/Correios PAC/)).not.toBeInTheDocument();
    fireEvent.submit(document.getElementById("checkout-form")!);
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("cupom novo bloqueia o pagamento até recalcular o frete da mesma cesta", async () => {
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    await screen.findByText(/Correios PAC/);
    const pay = screen.getByRole("button", { name: /Gerar Pix/ });
    await waitFor(() => expect(pay).toBeEnabled());
    mocks.quote.mockReturnValueOnce(new Promise(() => undefined));
    fireEvent.click(screen.getByRole("button", { name: "Tem um cupom?" }));
    fireEvent.change(screen.getByLabelText("Código do cupom"), {
      target: { value: "BEMVINDA5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(
      await screen.findByText(/Cupom BEMVINDA5 aplicado aos itens elegíveis/),
    ).toBeInTheDocument();
    expect(pay).toBeDisabled();
    expect(screen.queryByText(/Correios PAC/)).not.toBeInTheDocument();
    fireEvent.submit(document.getElementById("checkout-form")!);
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("oferece nova cotação de frete após falha transitória, sem iniciar pagamento", async () => {
    mocks.quote.mockResolvedValueOnce({ ok: false, message: "Transportadora indisponível" });
    render(<Checkout />);
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "30140010" } });
    expect(await screen.findByText("Transportadora indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar calcular frete novamente" }));
    expect(await screen.findByText(/Correios PAC/)).toBeInTheDocument();
    expect(mocks.quote).toHaveBeenCalledTimes(2);
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("envia ao servidor o total em centavos que foi mostrado antes da compra", async () => {
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    await waitFor(() => expect(mocks.payment).toHaveBeenCalledOnce());
    const submitted = mocks.payment.mock.calls[0]![0].data;
    expect(submitted.quotedTotalCents).toBeGreaterThan(0);
    expect(Number.isSafeInteger(submitted.quotedTotalCents)).toBe(true);
    expect(submitted.serviceId).toBe(option.id);
  });
  it("perda da resposta do gateway impede nova tentativa e persiste guarda após recarregar", async () => {
    mocks.payment.mockRejectedValueOnce(new Error("simulated connection lost after submission"));
    const checkout = render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(
      await screen.findByRole("heading", { name: "Pagamento em verificação" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/não tente gerar outro Pix ou pagar com outro cartão/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar Pix/ })).not.toBeInTheDocument();
    expect(mocks.payment).toHaveBeenCalledTimes(1);
    const marker = sessionStorage.getItem(UNCERTAIN_PAYMENT_KEY);
    expect(marker).toContain('"method":"pix"');
    expect(marker).not.toContain("52998224725");
    expect(marker).not.toContain("teste@example.com");
    checkout.unmount();
    render(<Checkout />);
    expect(
      await screen.findByRole("heading", { name: "Pagamento em verificação" }),
    ).toBeInTheDocument();
    expect(mocks.payment).toHaveBeenCalledTimes(1);
  });

  it("marca tentativa como pendente antes de enviar dados e remove o bloqueio após negativa segura", async () => {
    let reply: ((value: unknown) => void) | undefined;
    mocks.payment.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          reply = resolve;
        }),
    );
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    await waitFor(() => expect(mocks.payment).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(UNCERTAIN_PAYMENT_KEY)).toContain('"method":"pix"');
    await act(async () => {
      reply?.({ ok: false, message: "Dados inválidos antes da cobrança" });
    });
    expect(await screen.findByText("Dados inválidos antes da cobrança")).toBeInTheDocument();
    expect(sessionStorage.getItem(UNCERTAIN_PAYMENT_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeEnabled();
  });

  it("erro ambíguo explícito do servidor bloqueia nova cobrança mesmo com HTTP 200", async () => {
    mocks.payment.mockResolvedValueOnce({
      ok: false,
      retrySafe: false,
      message: "Não foi possível confirmar a tentativa de compra.",
    });
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(
      await screen.findByRole("heading", { name: "Pagamento em verificação" }),
    ).toBeInTheDocument();
    expect(mocks.payment).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(UNCERTAIN_PAYMENT_KEY)).toContain('"method":"pix"');
  });

  it("validação negada antes da cobrança libera correção de dados sem manter guarda", async () => {
    mocks.payment.mockResolvedValueOnce({ ok: false, message: "Cupom inválido" });
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(await screen.findByText("Cupom inválido")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Pagamento em verificação" }),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem(UNCERTAIN_PAYMENT_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: /Gerar Pix/ })).toBeEnabled();
  });

  it("permite solicitar Pix com cookies opcionais recusados sem disparar analytics", async () => {
    localStorage.setItem(TRACKING_CONSENT_KEY, "rejected");
    const gtag = window.gtag;
    const fbq = window.fbq;
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    await waitFor(() => expect(mocks.payment).toHaveBeenCalledTimes(1));
    expect(mocks.payment).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ marketingConsent: false }) }),
    );
    expect(vi.mocked(gtag!).mock.calls).toHaveLength(0);
    expect(vi.mocked(fbq!).mock.calls).toHaveLength(0);
  });
  it("inclui opt-in de marketing no checkout quando o visitante aceitou", async () => {
    localStorage.setItem(TRACKING_CONSENT_KEY, "accepted");
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    await waitFor(() => expect(mocks.payment).toHaveBeenCalledTimes(1));
    expect(mocks.payment).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ marketingConsent: true }) }),
    );
  });
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
  it("sessão adulterada paid:true não libera outro checkout nem comprova pagamento", async () => {
    savePendingCard({
      orderId: 765,
      statusToken: "signed-read-only-test-token-0000010",
      total: 154.9,
      paid: true,
      status: "aprovado",
    });
    mocks.status.mockResolvedValue({ ok: true, paid: false, status: "autorizado" });
    render(<Checkout />);
    expect(
      await screen.findByRole("heading", { name: "Pagamento em análise" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pagamento aprovado!" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerar Pix/ })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.status).toHaveBeenCalledWith({
        data: { orderId: 765, statusToken: "signed-read-only-test-token-0000010" },
      }),
    );
    expect(mocks.payment).not.toHaveBeenCalled();
    expect(mocks.cart.clear).not.toHaveBeenCalled();
  });
  it("registra só a identidade dos itens quando cria um novo Pix, sem armazenar dados pessoais", async () => {
    mocks.payment.mockResolvedValueOnce({
      ok: true,
      method: "pix",
      orderId: 8780,
      statusToken: "signed-test-checkout-pix-8780",
      total: 169.9,
      pix: { emv: "pix-synthetic", qrcode: "dGVzdA==", expiresAt: "2027-01-01 12:00:00" },
    });
    mocks.status.mockResolvedValue({ ok: true, paid: false, status: "pendente" });
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(await screen.findByRole("heading", { name: "Pague com Pix" })).toBeInTheDocument();
    const product = getProduct("kit-banana-e-mel")!;
    expect(restorePurchaseBasket(8780)).toEqual([
      {
        slug: product.slug,
        variant: product.variants[0].label,
        qty: 1,
      },
    ]);
    expect(mocks.payment).toHaveBeenCalledTimes(1);
  });

  it("recuperação de pedido anterior não atribui ao pedido uma nova sacola", async () => {
    mocks.payment.mockResolvedValueOnce({
      ok: true,
      method: "verification",
      orderId: 8781,
      statusToken: "signed-test-checkout-verification-8781",
      total: 169.9,
      paid: false,
      status: "aguardando_confirmacao",
    });
    mocks.status.mockResolvedValue({ ok: true, paid: false, status: "aguardando_confirmacao" });
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: /Gerar Pix/ }));
    expect(
      await screen.findByRole("heading", { name: "Pedido em verificação" }),
    ).toBeInTheDocument();
    expect(restorePurchaseBasket(8781)).toBeNull();
    expect(mocks.cart.clear).not.toHaveBeenCalled();
    expect(mocks.payment).toHaveBeenCalledTimes(1);
  });

  it.each(["card", "pix"] as const)(
    "não apaga produtos novos nem os atribui à compra antiga quando %s pendente é pago",
    async (method) => {
      const orderId = method === "card" ? 8761 : 8762;
      const statusToken = "signed-test-order-pending-restore-876100";
      const purchased = getProduct("kit-banana-e-mel")!;
      savePurchaseBasket(orderId, [
        {
          slug: purchased.slug,
          variant: purchased.variants[0].label,
          qty: 1,
        },
      ]);
      if (method === "card") {
        savePendingCard({ orderId, statusToken, total: 154.9, paid: false, status: "autorizado" });
      } else {
        savePendingPix({
          orderId,
          statusToken,
          total: 154.9,
          emv: "synthetic-pix",
          qrcode: "dGVzdA==",
          expiresAt: "2027-01-01 12:00:00",
        });
      }
      let resolveStatus: ((v: { ok: true; paid: boolean; status: string }) => void) | undefined;
      mocks.status.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStatus = resolve;
          }),
      );
      render(<Checkout />);
      await waitFor(() => expect(mocks.status).toHaveBeenCalled());
      const nextProduct = getProduct("queratina-em-gel")!;
      // The paid item's original line remains, but a NEW item was added
      // before Appmax confirmed the old payment.
      mocks.cart.lines = [
        ...mocks.cart.lines,
        {
          slug: nextProduct.slug,
          variant: nextProduct.variants[0].label,
          qty: 1,
          product: nextProduct,
          price: nextProduct.variants[0].price,
          ...lineTotals(nextProduct.variants[0].price, 1),
        },
      ];
      await act(async () => resolveStatus?.({ ok: true, paid: true, status: "aprovado" }));
      await waitFor(() =>
        expect(screen.getByText(/Pagamento (aprovado|confirmado)/i)).toBeInTheDocument(),
      );
      expect(mocks.cart.clear).not.toHaveBeenCalled();
      const events = vi.mocked(window.gtag!).mock.calls.filter((call) => call[1] === "purchase");
      expect(events).toHaveLength(1);
      expect(JSON.stringify(events[0]?.[2])).not.toContain(nextProduct.slug.toUpperCase());
    },
  );

  it("confirma o pedido antigo sem eliminar o snapshot de uma segunda compra ainda pendente", async () => {
    const first = getProduct("kit-banana-e-mel")!;
    const second = getProduct("queratina-em-gel")!;
    savePurchaseBasket(8871, [{ slug: first.slug, variant: first.variants[0].label, qty: 1 }]);
    savePurchaseBasket(8872, [{ slug: second.slug, variant: second.variants[0].label, qty: 1 }]);
    savePendingCard({
      orderId: 8871,
      statusToken: "signed-test-older-order-8871000000",
      total: 169.9,
      paid: false,
      status: "autorizado",
    });
    mocks.status.mockResolvedValueOnce({ ok: true, paid: true, status: "aprovado" });
    render(<Checkout />);
    expect(await screen.findByRole("heading", { name: "Pagamento aprovado!" })).toBeInTheDocument();
    expect(mocks.cart.clear).toHaveBeenCalledTimes(1);
    expect(restorePurchaseBasket(8871)).toBeNull();
    expect(restorePurchaseBasket(8872)).toEqual([
      { slug: second.slug, variant: second.variants[0].label, qty: 1 },
    ]);
    const events = vi.mocked(window.gtag!).mock.calls.filter((call) => call[1] === "purchase");
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0]?.[2])).not.toContain(second.slug.toUpperCase());
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("cartão pago em sessão só é confirmado após status autenticado", async () => {
    const purchased = getProduct("kit-banana-e-mel")!;
    savePurchaseBasket(766, [
      { slug: purchased.slug, variant: purchased.variants[0].label, qty: 1 },
    ]);
    savePendingCard({
      orderId: 766,
      statusToken: "signed-read-only-test-token-0000011",
      total: 154.9,
      paid: true,
      status: "aprovado",
    });
    let resolveStatus: ((data: { ok: true; paid: boolean; status: string }) => void) | undefined;
    mocks.status.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
    );
    render(<Checkout />);
    expect(
      await screen.findByRole("heading", { name: "Pagamento em análise" }),
    ).toBeInTheDocument();
    expect(mocks.cart.clear).not.toHaveBeenCalled();
    await act(async () => {
      resolveStatus?.({ ok: true, paid: true, status: "aprovado" });
    });
    expect(await screen.findByRole("heading", { name: "Pagamento aprovado!" })).toBeInTheDocument();
    expect(mocks.cart.clear).toHaveBeenCalledTimes(1);
    expect(restorePurchaseBasket(766)).toBeNull();
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
    const getScript = async () =>
      waitFor(() => {
        const script = document.querySelector('script[src*="appmax.min.js"]');
        expect(script).not.toBeNull();
        return script!;
      });
    const script = await getScript();
    expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeDisabled();
    fireEvent.error(script);
    expect(
      await screen.findByText(/Não foi possível carregar a validação segura do cartão/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeDisabled();
    expect(mocks.payment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Recarregar validação" }));
    window.AppmaxScripts = { init: vi.fn() };
    const retryScript = await getScript();
    fireEvent.load(retryScript);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeEnabled(),
    );
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
    expect(
      await screen.findByText(/Não foi possível carregar a validação segura do cartão/),
    ).toBeInTheDocument();
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
    expect(
      await screen.findByRole("heading", { name: "Pagamento online indisponível" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar à sacola" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Falar com atendimento" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "CPF" })).not.toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });
  it("aceita cupom de afiliada somente com confirmação do servidor, sem chamar pagamento", async () => {
    mocks.couponLookup.mockResolvedValueOnce({
      ok: true,
      code: "MARISSOL10",
      label: "Cupom validado em QA",
      percent: 10,
    });
    render(<Checkout />);
    fireEvent.click(screen.getByRole("button", { name: "Tem um cupom?" }));
    fireEvent.change(screen.getByLabelText("Código do cupom"), { target: { value: "marissol10" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText(/Cupom ativo: MARISSOL10/)).toBeInTheDocument();
    expect(mocks.couponLookup).toHaveBeenCalledWith({ data: { code: "MARISSOL10" } });
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("bloqueia pagamento enquanto cupom de afiliada é validado e descarta resultado antigo", async () => {
    let resolveLookup: (value: {
      ok: boolean;
      code: string;
      label: string;
      percent: number;
    }) => void = () => undefined;
    mocks.couponLookup.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }),
    );
    render(<Checkout />);
    await fill();
    const pay = screen.getByRole("button", { name: /Gerar Pix/ });
    await waitFor(() => expect(pay).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Tem um cupom?" }));
    const couponInput = screen.getByLabelText("Código do cupom");
    fireEvent.change(couponInput, { target: { value: "MARISSOL10" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(screen.getByText(/Conferindo cupom de afiliada/)).toBeInTheDocument();
    expect(pay).toBeDisabled();
    fireEvent.submit(document.getElementById("checkout-form")!);
    expect(mocks.payment).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Aguarde a validação do cupom antes de iniciar o pagamento/),
    ).toBeInTheDocument();
    fireEvent.change(couponInput, { target: { value: "BEMVINDA5" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText(/Cupom BEMVINDA5 aplicado/)).toBeInTheDocument();
    await waitFor(() => expect(pay).toBeEnabled());
    await act(async () =>
      resolveLookup({
        ok: true,
        code: "MARISSOL10",
        label: "Cupom obsoleto (QA)",
        percent: 10,
      }),
    );
    expect(screen.getByText(/Cupom ativo: BEMVINDA5/)).toBeInTheDocument();
    expect(screen.queryByText(/Cupom ativo: MARISSOL10/)).not.toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("congela o formulário durante envio Pix e ignora cupom de indicação tardio", async () => {
    let resolveLookup: (value: {
      ok: boolean;
      code: string;
      label: string;
      percent: number;
    }) => void = () => undefined;
    captureRef("?ref=marissol");
    mocks.couponLookup.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }),
    );
    mocks.payment.mockReturnValueOnce(new Promise(() => undefined));
    render(<Checkout />);
    await fill();
    const pay = screen.getByRole("button", { name: /Gerar Pix/ });
    await waitFor(() => expect(pay).toBeEnabled());
    fireEvent.click(pay);
    await waitFor(() => expect(mocks.payment).toHaveBeenCalledTimes(1));
    expect(document.getElementById("checkout-form")).toHaveAttribute("inert");
    expect(document.getElementById("checkout-form")).toHaveAttribute("aria-busy", "true");
    expect(pay).toBeDisabled();
    await act(async () =>
      resolveLookup({
        ok: true,
        code: "MARISSOL10",
        label: "Cupom de indicação tardio",
        percent: 10,
      }),
    );
    expect(screen.queryByText(/Cupom ativo: MARISSOL10/)).not.toBeInTheDocument();
    expect(mocks.payment).toHaveBeenCalledTimes(1);
  });

  it("falha na validação remota de cupom de afiliada não aplica desconto nem tenta pagar", async () => {
    mocks.couponLookup.mockResolvedValueOnce({ ok: false });
    render(<Checkout />);
    fireEvent.click(screen.getByRole("button", { name: "Tem um cupom?" }));
    fireEvent.change(screen.getByLabelText("Código do cupom"), { target: { value: "MARISSOL10" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText(/Cupom não encontrado/)).toBeInTheDocument();
    expect(screen.queryByText(/Cupom ativo: MARISSOL10/)).not.toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("aplica cupom de afiliada capturado no link só depois da confirmação do servidor", async () => {
    captureRef("?ref=marissol");
    mocks.couponLookup.mockResolvedValueOnce({
      ok: true,
      code: "MARISSOL10",
      label: "Cupom de indicação confirmado",
      percent: 10,
    });
    render(<Checkout />);
    expect(await screen.findByText(/Cupom ativo: MARISSOL10/)).toBeInTheDocument();
    expect(mocks.couponLookup).toHaveBeenCalledWith({ data: { code: "MARISSOL10" } });
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("Enter no campo de cupom aplica desconto sem submeter o formulário de pagamento", async () => {
    render(<Checkout />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Tem um cupom?" }));
    const couponInput = screen.getByLabelText("Código do cupom");
    fireEvent.change(couponInput, { target: { value: "BEMVINDA5" } });
    const acceptedNativeSubmit = fireEvent.keyDown(couponInput, {
      key: "Enter",
      code: "Enter",
      charCode: 13,
      keyCode: 13,
    });
    expect(acceptedNativeSubmit).toBe(false);
    expect(
      await screen.findByText(/Cupom BEMVINDA5 aplicado aos itens elegíveis/),
    ).toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("cupom inválido digitado após um válido não esconde que o desconto anterior segue ativo", async () => {
    render(<Checkout />);
    fireEvent.click(screen.getByRole("button", { name: "Tem um cupom?" }));
    const input = screen.getByLabelText("Código do cupom");
    fireEvent.change(input, { target: { value: "BEMVINDA5" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText(/Cupom BEMVINDA5 aplicado/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "INEXISTENTE" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(screen.getByText(/Cupom ativo: BEMVINDA5/)).toBeInTheDocument();
    expect(screen.getByText(/Cupom não encontrado/)).toBeInTheDocument();
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("não promete aplicar cupom a uma cesta totalmente promocional", async () => {
    const p = getProduct("kit-banana-e-mel")!;
    const v = p.variants[0];
    const t = lineTotals(v.price, 2);
    mocks.cart.lines = [
      { product: p, slug: p.slug, variant: v.label, qty: 2, price: v.price, ...t },
    ];
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
      {
        product: singleP,
        slug: singleP.slug,
        variant: singleV.label,
        qty: 1,
        price: singleV.price,
        ...one,
      },
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
    expect(screen.getByRole("radio", { name: /Cartão de crédito/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Pix/ })).toBeChecked();
    expect(
      screen.getByText(/Cartão de crédito · até 6x sem juros \(indisponível\)/),
    ).toBeInTheDocument();
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
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /Cartão de crédito/ })).toBeChecked(),
    );
    expect(screen.getByRole("radio", { name: /Pix/ })).toBeDisabled();
    const sdk = await waitFor(() => {
      const element = document.querySelector('script[src*="appmax.min.js"]');
      expect(element).not.toBeNull();
      return element!;
    });
    expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeDisabled();
    fireEvent.load(sdk);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Pagar .* no cartão/ })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: /Pagar .* no cartão/ }).className).toContain(
      "bg-emerald-600",
    );
    const pixRadio = screen.getByRole("radio", { name: /Pix/ });
    expect(pixRadio).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Cartão de crédito/ })).toBeChecked();
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
  it("cotação no produto não fica travada quando endereço não responde, com frete disponível", async () => {
    mocks.address.mockImplementationOnce(() => new Promise(() => undefined));
    render(<ShippingCalc subtotal={169.9} slug="kit-banana-e-mel" variant="Kit" qty={1} />);
    fireEvent.change(screen.getByLabelText("CEP de entrega"), { target: { value: "30140010" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    expect(await screen.findByText("Correios PAC")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Calcular" })).toBeEnabled());
    expect(mocks.quote).toHaveBeenCalledOnce();
  });

  it("frete do produto termina após 12s sem resposta e ignora transportadora tardia", async () => {
    let resolveLate: (value: { ok: true; options: (typeof option)[] }) => void = () => undefined;
    mocks.quote.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLate = resolve;
        }),
    );
    render(<ShippingCalc subtotal={169.9} slug="kit-banana-e-mel" variant="Kit" qty={1} />);
    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByLabelText("CEP de entrega"), { target: { value: "30140010" } });
      fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
      expect(screen.getByRole("button", { name: "..." })).toBeDisabled();
      await act(async () => vi.advanceTimersByTime(12000));
      expect(screen.getByRole("button", { name: "Calcular" })).toBeEnabled();
      expect(screen.getByText(/O cálculo de frete demorou demais/)).toBeInTheDocument();
      await act(async () => resolveLate({ ok: true, options: [option] }));
      expect(screen.queryByText("Correios PAC")).not.toBeInTheDocument();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
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
    expect(screen.getByText(/Guarde este número para acompanhar seu pedido/)).toBeInTheDocument();
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

describe("acessibilidade da sacola", () => {
  it("controles de quantidade e remoção identificam o produto e têm área de toque mínima", () => {
    render(<Cart />);
    const product = getProduct("kit-banana-e-mel")!;
    const variant = product.variants[0]!.label;
    for (const action of ["Diminuir quantidade", "Aumentar quantidade", "Remover"]) {
      const control = screen.getByRole("button", {
        name: new RegExp(
          action === "Remover" ? `Remover ${product.name}` : `${action} de ${product.name}`,
          "i",
        ),
      });
      expect(control).toHaveAttribute("type", "button");
      expect(control.className).toMatch(/min-h-11/);
      expect(control.className).toMatch(/min-w-11/);
      expect(control.getAttribute("aria-label")).toContain(variant);
    }
  });

  it("limite de 99 unidades é anunciado ao desabilitar aumento da sacola", () => {
    const item = mocks.cart.lines[0] as { qty: number };
    item.qty = 99;
    render(<Cart />);
    const p = getProduct("kit-banana-e-mel")!;
    expect(
      screen.getByRole("button", { name: new RegExp(`Aumentar quantidade de ${p.name}`, "i") }),
    ).toBeDisabled();
    expect(mocks.cart.add).not.toHaveBeenCalled();
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("sugestões usam nomes acessíveis únicos para adicionar produtos", () => {
    render(<Cart />);
    const suggested = screen.getAllByRole("button", { name: /Adicionar .* à sacola/ });
    expect(suggested.length).toBeGreaterThan(0);
    expect(new Set(suggested.map((b) => b.getAttribute("aria-label"))).size).toBe(suggested.length);
    expect(suggested.every((b) => b.className.includes("min-h-11"))).toBe(true);
  });
});

describe("complemento do carrinho", () => {
  it("registra AddToCart com o desconto realmente aplicado ao item", () => {
    render(<Cart />);
    fireEvent.click(screen.getAllByRole("button", { name: /Adicionar .* à sacola/ })[0]!);
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

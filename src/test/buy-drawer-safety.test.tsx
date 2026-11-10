import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProduct, lineTotals } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  setQty: vi.fn(),
  remove: vi.fn(),
  onPay: vi.fn(),
  onClose: vi.fn(),
  track: vi.fn(),
  extras: vi.fn(() => [] as unknown[]),
  cart: { lines: [] as unknown[], subtotal: 0, netSubtotal: 0 },
}));

vi.mock("@/lib/store", async (load) => ({
  ...(await load<Record<string, unknown>>()),
  useCart: () => ({
    ...mocks.cart,
    add: mocks.add,
    setQty: mocks.setQty,
    remove: mocks.remove,
  }),
}));
vi.mock("@/lib/upsell", () => ({ pickExtras: mocks.extras }));
vi.mock("@/lib/analytics", async (load) => ({
  ...(await load<Record<string, unknown>>()),
  track: mocks.track,
}));

import { BuyDrawer } from "@/components/buy-drawer";

function arrange(qty = 1) {
  const p = getProduct("kit-banana-e-mel")!;
  const v = p.variants[0]!;
  const amounts = lineTotals(v.price, qty);
  mocks.cart.lines = [
    {
      slug: p.slug,
      variant: v.label,
      qty,
      units: qty,
      product: p,
      net: amounts.net,
      gross: amounts.gross,
    },
  ];
  mocks.cart.subtotal = amounts.gross;
  mocks.cart.netSubtotal = amounts.net;
  return p;
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  mocks.extras.mockReturnValue([]);
  arrange();
});

describe("gaveta de compra segura", () => {
  it("nunca promete frete gratuito sem verificar cobertura do CEP, mesmo superando mínimo", () => {
    arrange(2);
    render(<BuyDrawer onClose={mocks.onClose} onPay={mocks.onPay} />);
    expect(screen.queryByText(/você ganhou frete grátis/i)).not.toBeInTheDocument();
    expect(screen.getByText(/sujeit|depende|cotação.*cep/i)).toBeInTheDocument();
    expect(screen.getByText(/atingiu o valor mínimo/i)).toBeInTheDocument();
  });

  it("permite fechar com Escape, dá foco ao fechar e restaura o foco de origem", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const view = render(<BuyDrawer onClose={mocks.onClose} onPay={mocks.onPay} />);
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Continuar comprando" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("trava rolagem de fundo no diálogo e a restaura ao sair", () => {
    document.body.style.overflow = "auto";
    const view = render(<BuyDrawer onClose={mocks.onClose} onPay={mocks.onPay} />);
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });

  it("não permite diminuir 1 para 0 nem aumentar além de 99, mantendo remover separado", () => {
    const p = arrange(1);
    const view = render(<BuyDrawer onClose={mocks.onClose} onPay={mocks.onPay} />);
    expect(
      screen.getByRole("button", {
        name: `Diminuir quantidade de ${p.name}, ${p.variants[0]!.label}`,
      }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", {
        name: `Diminuir quantidade de ${p.name}, ${p.variants[0]!.label}`,
      }),
    );
    expect(mocks.setQty).not.toHaveBeenCalled();
    view.unmount();
    arrange(99);
    render(<BuyDrawer onClose={mocks.onClose} onPay={mocks.onPay} />);
    expect(
      screen.getByRole("button", {
        name: `Aumentar quantidade de ${p.name}, ${p.variants[0]!.label}`,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: `Remover ${p.name}, ${p.variants[0]!.label}` }),
    ).toBeEnabled();
    expect(mocks.onPay).not.toHaveBeenCalled();
  });

  it("bloqueia avançar com carrinho vazio, sem criar pagamento", () => {
    mocks.cart.lines = [];
    mocks.cart.subtotal = 0;
    mocks.cart.netSubtotal = 0;
    render(<BuyDrawer onClose={mocks.onClose} onPay={mocks.onPay} />);
    expect(screen.getByRole("button", { name: /ir para o pagamento/i })).toBeDisabled();
    expect(mocks.onPay).not.toHaveBeenCalled();
  });

  it("sugestão informa qual produto será adicionado sem criar pagamento", () => {
    const suggestion = getProduct("kit-cafe-verde")!;
    const variant = suggestion.variants[0]!;
    mocks.extras.mockReturnValue([suggestion]);
    render(<BuyDrawer onClose={mocks.onClose} onPay={mocks.onPay} />);
    fireEvent.click(
      screen.getByRole("button", { name: `Adicionar ${suggestion.name} ao carrinho` }),
    );
    expect(mocks.add).toHaveBeenCalledWith(suggestion.slug, variant.label, 1);
    expect(mocks.track).toHaveBeenCalledTimes(1);
    expect(mocks.onPay).not.toHaveBeenCalled();
  });

  it("permite editar quantidade e seguir ao checkout apenas pela ação explícita", () => {
    const p = arrange();
    render(<BuyDrawer onClose={mocks.onClose} onPay={mocks.onPay} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: `Aumentar quantidade de ${p.name}, ${p.variants[0]!.label}`,
      }),
    );
    expect(mocks.setQty).toHaveBeenCalledWith(p.slug, p.variants[0]!.label, 2, undefined);
    expect(mocks.onPay).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /ir para o pagamento/i }));
    expect(mocks.onPay).toHaveBeenCalledOnce();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { getProduct } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  lines: [] as Array<Record<string, unknown>>,
  setQty: vi.fn(),
  remove: vi.fn(),
  add: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/site", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/cart-summary", () => ({
  ShippingBar: () => <div />,
  Summary: () => <div />,
}));
vi.mock("@/lib/store", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useCart: () => ({
    lines: mocks.lines,
    subtotal: 169.9,
    netSubtotal: 169.9,
    count: mocks.lines.length,
    setQty: mocks.setQty,
    remove: mocks.remove,
    add: mocks.add,
  }),
  useHydrated: () => true,
  complementsFor: () => [],
}));
vi.mock("@/lib/analytics", () => ({
  track: mocks.track,
  toItem: () => ({
    item_id: "TEST",
    item_name: "TEST",
    item_variant: "TEST",
    price: 169.9,
    quantity: 1,
  }),
}));

import { Route } from "@/routes/carrinho";
const Cart = (Route as unknown as { options: { component: React.ComponentType } }).options
  .component;

function arrange(qty: number) {
  const p = getProduct("kit-banana-e-mel")!;
  const variant = p.variants[0]!;
  mocks.lines = [
    {
      slug: p.slug,
      variant: variant.label,
      product: p,
      qty,
      units: qty,
      price: variant.price,
      gross: variant.price * qty,
      net: variant.price * qty,
      pct: 0,
    },
  ];
  return { p, variant };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lines = [];
});

describe("sacola segura: quantidades, remoção e privacidade", () => {
  it("não indexa a sacola individual", () => {
    const head = (
      Route as unknown as {
        options: { head: () => { meta: Array<{ name?: string; content: string }> } };
      }
    ).options.head();
    expect(head.meta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "robots", content: "noindex, nofollow" }),
      ]),
    );
  });

  it("em uma unidade, diminuir é desativado; remover continua separado", () => {
    const { p, variant } = arrange(1);
    render(<Cart />);
    const minus = screen.getByRole("button", {
      name: `Diminuir quantidade de ${p.name}, ${variant.label}`,
    });
    const plus = screen.getByRole("button", {
      name: `Aumentar quantidade de ${p.name}, ${variant.label}`,
    });
    const remove = screen.getByRole("button", { name: `Remover ${p.name}, ${variant.label}` });
    expect(minus).toBeDisabled();
    fireEvent.click(minus);
    expect(mocks.setQty).not.toHaveBeenCalled();
    expect(plus).toBeEnabled();
    fireEvent.click(plus);
    expect(mocks.setQty).toHaveBeenCalledWith(p.slug, variant.label, 2, undefined);
    expect(remove).toBeEnabled();
    fireEvent.click(remove);
    expect(mocks.remove).toHaveBeenCalledWith(p.slug, variant.label, undefined);
  });

  it("em 99 unidades, aumentar é desativado; diminuir mantém item", () => {
    const { p, variant } = arrange(99);
    render(<Cart />);
    const plus = screen.getByRole("button", {
      name: `Aumentar quantidade de ${p.name}, ${variant.label}`,
    });
    const minus = screen.getByRole("button", {
      name: `Diminuir quantidade de ${p.name}, ${variant.label}`,
    });
    expect(plus).toBeDisabled();
    fireEvent.click(plus);
    expect(mocks.setQty).not.toHaveBeenCalled();
    expect(minus).toBeEnabled();
    fireEvent.click(minus);
    expect(mocks.setQty).toHaveBeenCalledWith(p.slug, variant.label, 98, undefined);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

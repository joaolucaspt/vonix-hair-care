import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  coupon: vi.fn(),
  ref: vi.fn(() => "marissol"),
  track: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/" }),
  Link: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <a href="/loja" onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/affiliate-ref", () => ({
  getRef: mocks.ref,
  captureRef: vi.fn(),
}));
vi.mock("@/lib/checkout.functions", () => ({ lookupCoupon: mocks.coupon }));
vi.mock("@/lib/analytics", () => ({ track: mocks.track }));

import { AffiliatePopup } from "@/components/affiliate-popup";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.ref.mockReturnValue("marissol");
  mocks.coupon.mockResolvedValue({
    ok: true,
    code: "MARISSOL10",
    percent: 10,
    label: "10% OFF (cupom da Maria)",
  });
});
afterEach(() => cleanup());

describe("comunicação do cupom de indicação no e-commerce", () => {
  it("avisa que descontos valem só para itens elegíveis, sem prometer 10% em qualquer compra", async () => {
    render(<AffiliatePopup />);
    const dialog = await screen.findByRole(
      "dialog",
      { name: "Desconto da afiliada" },
      { timeout: 3000 },
    );
    expect(dialog).toHaveTextContent(/itens elegíveis/);
    expect(dialog).toHaveTextContent(/sem outra oferta/);
    expect(dialog).not.toHaveTextContent(/em qualquer compra/);
    const close = screen.getByRole("button", { name: "Fechar" });
    expect(close.className).toContain("h-11");
    fireEvent.click(close);
    expect(screen.queryByRole("dialog", { name: "Desconto da afiliada" })).not.toBeInTheDocument();
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });

  it("não mostra o anúncio quando a validação de afiliada é recusada", async () => {
    mocks.coupon.mockResolvedValue({ ok: false });
    render(<AffiliatePopup />);
    await waitFor(() => expect(mocks.coupon).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog", { name: "Desconto da afiliada" })).not.toBeInTheDocument();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});

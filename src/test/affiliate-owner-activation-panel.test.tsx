import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  generate: vi.fn(),
  clipboard: vi.fn(),
}));

vi.mock("@/lib/affiliate-functions", () => ({
  getPendingAffiliateOwnerActivations: mocks.list,
  createPendingAffiliateOwnerActivationLink: mocks.generate,
}));

import { AffiliateOwnerActivationPanel } from "@/components/affiliate-owner-activation-panel";

const email = "pending.owner@example.invalid";
const token = "https://vonixhair.com/acesso-equipe-afiliadas#vonix_invite=" + "a".repeat(64);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue({ ok: true, owners: [{ email }] });
  mocks.generate.mockResolvedValue({ ok: true, recipient: email, link: token });
  mocks.clipboard.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mocks.clipboard },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("owner activation control, private one-time links", () => {
  it("does not render addresses or controls for non-owner sessions", async () => {
    mocks.list.mockResolvedValue({ ok: false, owners: [] });
    const { container } = render(<AffiliateOwnerActivationPanel />);
    await waitFor(() => expect(mocks.list).toHaveBeenCalledOnce());
    expect(container.querySelector("section")).toBeNull();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("requires owner confirmation, generates only for the selected pending user, and copies once", async () => {
    render(<AffiliateOwnerActivationPanel />);
    expect(await screen.findByText(email)).toBeInTheDocument();
    const create = screen.getByRole("button", { name: "Gerar link individual" });
    expect(create).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(create).toBeEnabled();
    fireEvent.click(create);
    expect(
      await screen.findByRole("button", { name: /Copiar link para compartilhar em privado/ }),
    ).toBeInTheDocument();
    expect(mocks.generate).toHaveBeenCalledWith({ data: { email } });
    expect(document.body.textContent).not.toContain("vonix_invite");
    expect(document.querySelector('a[href*="vonix_invite"]')).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Copiar link para compartilhar em privado/ }),
    );
    await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledWith(token));
    expect(
      screen.queryByRole("button", { name: /Copiar link para compartilhar em privado/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Link copiado");
  });

  it("does not claim delivery or expose a sensitive link after denied generation", async () => {
    mocks.generate.mockResolvedValue({
      ok: false,
      reason: "Aguarde o intervalo de segurança antes de gerar outro link para esta conta.",
    });
    render(<AffiliateOwnerActivationPanel />);
    await screen.findByText(email);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Aguarde o intervalo");
    expect(mocks.clipboard).not.toHaveBeenCalled();
  });

  it("renders no pending invitations when every owner has activated", async () => {
    mocks.list.mockResolvedValue({ ok: true, owners: [] });
    render(<AffiliateOwnerActivationPanel />);
    expect(await screen.findByText("Nenhum convite de proprietário pendente.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar link individual" })).not.toBeInTheDocument();
  });
});

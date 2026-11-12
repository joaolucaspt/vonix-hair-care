import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  generate: vi.fn(),
  clipboard: vi.fn(),
  inspect: vi.fn(),
}));

vi.mock("@/lib/affiliate-functions", () => ({
  getPendingAffiliateOwnerActivations: mocks.list,
  inspectAffiliateOwnerSenderStatus: mocks.inspect,
  createPendingAffiliateOwnerActivationLink: mocks.generate,
}));

import { AffiliateOwnerActivationPanel } from "@/components/affiliate-owner-activation-panel";

const email = "pending.owner@example.invalid";
const token = "https://vonixhair.com/acesso-equipe-afiliadas#vonix_invite=" + "a".repeat(64);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue({ ok: true, owners: [{ email }] });
  mocks.generate.mockResolvedValue({ ok: true, recipient: email, link: token });
  mocks.inspect.mockResolvedValue({
    ok: true,
    diagnosis: { status: "verified", domain: "vonixhair.com" },
  });
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

it("shows a non-sensitive retry when the pending-owner list fails to load initially", async () => {
  mocks.list.mockRejectedValueOnce(new TypeError("network unavailable"));
  render(<AffiliateOwnerActivationPanel />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível consultar os convites",
  );
  expect(screen.queryByText(email)).not.toBeInTheDocument();
  expect(mocks.generate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Tentar consultar convites novamente" }));
  expect(await screen.findByText(email)).toBeInTheDocument();
  expect(mocks.list).toHaveBeenCalledTimes(2);
});

it("does not issue repeated clipboard writes from a double-click on a private owner link", async () => {
  let resolveCopy!: () => void;
  mocks.clipboard.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      resolveCopy = resolve;
    }),
  );
  render(<AffiliateOwnerActivationPanel />);
  await screen.findByText(email);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
  const button = await screen.findByRole("button", {
    name: /Copiar link para compartilhar em privado/,
  });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledTimes(1));
  expect(button).toBeDisabled();
  resolveCopy();
  expect(await screen.findByText(/Link copiado/)).toBeInTheDocument();
});

it("offers retry for a temporary protected-roster backend failure without leaking recipients", async () => {
  mocks.list.mockResolvedValueOnce({
    ok: false,
    owners: [],
    reason: "temporarily-unavailable",
  });
  render(<AffiliateOwnerActivationPanel />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível consultar os convites",
  );
  expect(screen.queryByText(email)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar consultar convites novamente" }));
  expect(await screen.findByText(email)).toBeInTheDocument();
});

it("retains a safe retry path if an authorized owner refreshes the roster and the server fails", async () => {
  mocks.list
    .mockResolvedValueOnce({ ok: true, owners: [{ email }] })
    .mockResolvedValueOnce({ ok: false, owners: [], reason: "temporarily-unavailable" })
    .mockResolvedValueOnce({ ok: true, owners: [{ email }] });
  render(<AffiliateOwnerActivationPanel />);
  expect(await screen.findByText(email)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível consultar os convites",
  );
  expect(screen.queryByText(email)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar consultar convites novamente" }));
  expect(await screen.findByText(email)).toBeInTheDocument();
  expect(mocks.list).toHaveBeenCalledTimes(3);
});

it("shows retry without displaying stale owner addresses when refresh rejects over network", async () => {
  mocks.list
    .mockResolvedValueOnce({ ok: true, owners: [{ email }] })
    .mockRejectedValueOnce(new TypeError("provider offline"));
  render(<AffiliateOwnerActivationPanel />);
  await screen.findByText(email);
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Não foi possível consultar os convites",
  );
  expect(screen.queryByText(email)).not.toBeInTheDocument();
});

it("diagnoses verified Resend domain without sending an invitation or exposing private tokens", async () => {
  render(<AffiliateOwnerActivationPanel />);
  await screen.findByText(email);
  fireEvent.click(screen.getByRole("button", { name: "Verificar domínio do e-mail sem enviar" }));
  const result = await screen.findByRole("status", {
    name: "Diagnóstico do remetente de convites",
  });
  expect(result).toHaveTextContent("verificado no Resend");
  expect(result).toHaveTextContent("NÃO comprova a entrega");
  expect(mocks.inspect).toHaveBeenCalledOnce();
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.clipboard).not.toHaveBeenCalled();
  expect(document.body.textContent).not.toContain("vonix_invite");
});

it("does not mistake a sending-only Resend key for unverified DNS", async () => {
  mocks.inspect.mockResolvedValueOnce({ ok: true, diagnosis: { status: "read-restricted" } });
  render(<AffiliateOwnerActivationPanel />);
  await screen.findByText(email);
  fireEvent.click(screen.getByRole("button", { name: "Verificar domínio do e-mail sem enviar" }));
  expect(
    await screen.findByRole("status", { name: "Diagnóstico do remetente de convites" }),
  ).toHaveTextContent("permissão somente de envio");
});

it("conceals owner roster when a protected sender diagnosis denies authorization", async () => {
  mocks.inspect.mockResolvedValueOnce({ ok: false });
  render(<AffiliateOwnerActivationPanel />);
  await screen.findByText(email);
  fireEvent.click(screen.getByRole("button", { name: "Verificar domínio do e-mail sem enviar" }));
  await waitFor(() => expect(screen.queryByText(email)).not.toBeInTheDocument());
  expect(
    screen.queryByRole("button", { name: "Verificar domínio do e-mail sem enviar" }),
  ).not.toBeInTheDocument();
});

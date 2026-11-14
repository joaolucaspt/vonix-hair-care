import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("revokes an untransferred private activation link when the owner hides the tab", async () => {
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateOwnerActivationPanel />);
      await screen.findByText(email);
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
      expect(
        await screen.findByRole("button", { name: /Copiar link para compartilhar em privado/ }),
      ).toBeInTheDocument();
      spy.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(
        screen.queryByRole("button", { name: /Copiar link para compartilhar em privado/ }),
      ).not.toBeInTheDocument();
      expect(mocks.clipboard).not.toHaveBeenCalled();
      spy.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(await screen.findByRole("button", { name: "Gerar link individual" })).toBeDisabled();
    } finally {
      spy.mockRestore();
    }
  });

  it("discards an activation token that arrives after tab hide even if it becomes visible again", async () => {
    let release!: (result: unknown) => void;
    mocks.generate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateOwnerActivationPanel />);
      await screen.findByText(email);
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
      await waitFor(() => expect(mocks.generate).toHaveBeenCalledOnce());
      spy.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      spy.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(async () => {
        release({ ok: true, recipient: email, link: token });
        await Promise.resolve();
      });
      expect(
        screen.queryByRole("button", { name: /Copiar link para compartilhar em privado/ }),
      ).not.toBeInTheDocument();
      expect(mocks.clipboard).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("does not reveal pending owner addresses from a roster response that finishes in a hidden tab", async () => {
    let release!: (value: unknown) => void;
    mocks.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateOwnerActivationPanel />);
      await waitFor(() => expect(mocks.list).toHaveBeenCalledOnce());
      spy.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(async () => {
        release({ ok: true, owners: [{ email }] });
        await Promise.resolve();
      });
      expect(screen.queryByText(email)).not.toBeInTheDocument();
      spy.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(await screen.findByText(email)).toBeInTheDocument();
      expect(mocks.list).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it("never claims a sensitive invitation link was copied after the tab was hidden", async () => {
    let finish!: () => void;
    mocks.clipboard.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateOwnerActivationPanel />);
      await screen.findByText(email);
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
      fireEvent.click(
        await screen.findByRole("button", {
          name: /Copiar link para compartilhar em privado/,
        }),
      );
      await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledOnce());
      spy.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(async () => {
        finish();
        await Promise.resolve();
      });
      expect(screen.queryByText(/Link copiado\. Envie-o agora/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Copiar link para compartilhar em privado/ }),
      ).not.toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

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

it("offers native private sharing on supported phones without writing a bearer link into DOM or clipboard", async () => {
  const nativeShare = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { configurable: true, value: nativeShare });
  try {
    render(<AffiliateOwnerActivationPanel />);
    await screen.findByText(email);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
    const share = await screen.findByRole("button", {
      name: /Compartilhar link individual no celular/,
    });
    expect(document.body.textContent).not.toContain("vonix_invite");
    expect(document.querySelector('a[href*="vonix_invite"]')).toBeNull();
    fireEvent.click(share);
    await waitFor(() =>
      expect(nativeShare).toHaveBeenCalledExactlyOnceWith({
        title: "Convite individual Vonix Hair",
        url: token,
      }),
    );
    expect(mocks.clipboard).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /Compartilhar link individual no celular/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("não comprova que o destinatário recebeu");
  } finally {
    Reflect.deleteProperty(navigator, "share");
  }
});

it("keeps the single-use link recoverable if mobile sharing is canceled", async () => {
  const abort = new Error("cancel");
  abort.name = "AbortError";
  const nativeShare = vi.fn().mockRejectedValue(abort);
  Object.defineProperty(navigator, "share", { configurable: true, value: nativeShare });
  try {
    render(<AffiliateOwnerActivationPanel />);
    await screen.findByText(email);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Compartilhar link individual no celular/ }),
    );
    expect(await screen.findByText(/Compartilhamento cancelado/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copiar link para compartilhar em privado/ }),
    ).toBeEnabled();
    expect(document.body.textContent).not.toContain("vonix_invite");
    expect(nativeShare).toHaveBeenCalledTimes(1);
  } finally {
    Reflect.deleteProperty(navigator, "share");
  }
});

it("refuses overlapping mobile shares and falls back to copy after unsupported share", async () => {
  let rejectShare!: (reason: Error) => void;
  const nativeShare = vi.fn().mockReturnValue(
    new Promise<void>((_, reject) => {
      rejectShare = reject;
    }),
  );
  Object.defineProperty(navigator, "share", { configurable: true, value: nativeShare });
  try {
    render(<AffiliateOwnerActivationPanel />);
    await screen.findByText(email);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
    const button = await screen.findByRole("button", {
      name: /Compartilhar link individual no celular/,
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(nativeShare).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    rejectShare(new Error("not supported"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tente copiar o link");
    fireEvent.click(
      screen.getByRole("button", { name: /Copiar link para compartilhar em privado/ }),
    );
    await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledExactlyOnceWith(token));
    expect(document.body.textContent).not.toContain("vonix_invite");
  } finally {
    Reflect.deleteProperty(navigator, "share");
  }
});

it("C40 unlocks a new owner's link after tab hide interrupts an unresolved clipboard request", async () => {
  mocks.clipboard.mockImplementationOnce(() => new Promise<void>(() => {}));
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  try {
    render(<AffiliateOwnerActivationPanel />);
    await screen.findByText(email);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Copiar link para compartilhar em privado/ }),
    );
    await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledTimes(1));
    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(
      screen.queryByRole("button", { name: /Copiar link para compartilhar em privado/ }),
    ).not.toBeInTheDocument();
    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await screen.findByText(email);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Copiar link para compartilhar em privado/ }),
    );
    await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Link copiado/)).toBeInTheDocument();
  } finally {
    visibility.mockRestore();
  }
});

it("C40 allows clipboard recovery when an old native share never settles after hiding the tab", async () => {
  const nativeShare = vi.fn().mockReturnValue(new Promise<void>(() => {}));
  Object.defineProperty(navigator, "share", { configurable: true, value: nativeShare });
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  try {
    render(<AffiliateOwnerActivationPanel />);
    await screen.findByText(email);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Compartilhar link individual no celular/ }),
    );
    expect(nativeShare).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await screen.findByText(email);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Gerar link individual" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Copiar link para compartilhar em privado/ }),
    );
    await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Link copiado/)).toBeInTheDocument();
  } finally {
    visibility.mockRestore();
    Reflect.deleteProperty(navigator, "share");
  }
});

it("C37 discards a delayed Resend diagnosis after owner tab hide and reactivation", async () => {
  let resolveInspect!: (value: unknown) => void;
  mocks.inspect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveInspect = resolve;
      }),
  );
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  try {
    render(<AffiliateOwnerActivationPanel />);
    await screen.findByText(email);
    fireEvent.click(screen.getByRole("button", { name: "Verificar domínio do e-mail sem enviar" }));
    expect(mocks.inspect).toHaveBeenCalledOnce();
    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(await screen.findByText(email)).toBeInTheDocument();
    await act(async () => {
      resolveInspect({ ok: true, diagnosis: { status: "verified" } });
      await Promise.resolve();
    });
    expect(
      screen.queryByRole("status", { name: "Diagnóstico do remetente de convites" }),
    ).not.toBeInTheDocument();
  } finally {
    visibility.mockRestore();
  }
});

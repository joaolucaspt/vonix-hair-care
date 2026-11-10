import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  TRACKING_CONSENT_KEY,
  TRACKING_SESSION_REJECTION_KEY,
  TRACKING_PREFERENCES_EVENT,
  getTrackingConsent,
  hasTrackingConsent,
  saveTrackingConsent,
} from "@/lib/tracking-consent";
import { TrackingConsentBanner } from "@/components/tracking-consent";

const route = vi.hoisted(() => ({ path: "/" }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  useLocation: () => route.path,
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/politica-de-privacidade">{children}</a>
  ),
}));

beforeEach(() => {
  route.path = "/";
  window.localStorage.removeItem(TRACKING_CONSENT_KEY);
  window.sessionStorage.removeItem(TRACKING_SESSION_REJECTION_KEY);
});
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.removeItem(TRACKING_CONSENT_KEY);
  window.sessionStorage.removeItem(TRACKING_SESSION_REJECTION_KEY);
});

describe("preferências de privacidade", () => {
  it("exige aceitação explícita para rastreamento opcional", () => {
    expect(getTrackingConsent()).toBeNull();
    expect(hasTrackingConsent()).toBe(false);
    expect(saveTrackingConsent("rejected")).toBe(true);
    expect(getTrackingConsent()).toBe("rejected");
    expect(hasTrackingConsent()).toBe(false);
    expect(saveTrackingConsent("accepted")).toBe(true);
    expect(hasTrackingConsent()).toBe(true);
  });

  it("falha fechada quando o armazenamento é bloqueado", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    expect(getTrackingConsent()).toBeNull();
    expect(hasTrackingConsent()).toBe(false);
    expect(saveTrackingConsent("accepted")).toBe(false);
  });

  it("salva uma recusa na sessão quando localStorage é bloqueado", () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (this === window.localStorage) throw new DOMException("Blocked", "SecurityError");
      return original.call(this, key, value);
    });
    expect(saveTrackingConsent("rejected")).toBe(true);
    expect(window.sessionStorage.getItem(TRACKING_SESSION_REJECTION_KEY)).toBe("rejected");
    expect(getTrackingConsent()).toBe("rejected");
    expect(hasTrackingConsent()).toBe(false);
  });

  it("permite recusar para a aba atual mesmo sem nenhuma API de armazenamento", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    render(<TrackingConsentBanner />);
    fireEvent.click(await screen.findByRole("button", { name: "Recusar opcionais" }));
    expect(
      screen.queryByRole("region", { name: "Preferências de privacidade" }),
    ).not.toBeInTheDocument();
    expect(hasTrackingConsent()).toBe(false);
    fireEvent(window, new Event(TRACKING_PREFERENCES_EVENT));
    expect(await screen.findByText(/somente necessários/i)).toBeInTheDocument();
  });

  it("remove cookies opcionais acessíveis ao revogar a preferência", () => {
    document.cookie = "_fbp=sample; Path=/";
    document.cookie = "_ga=sample; Path=/";
    expect(document.cookie).toContain("_fbp=");
    expect(saveTrackingConsent("rejected")).toBe(true);
    expect(document.cookie).not.toContain("_fbp=");
    expect(document.cookie).not.toContain("_ga=");
  });

  it("permite recusar sem obrigar uma decisão para acessar a loja", async () => {
    render(<TrackingConsentBanner />);
    expect(
      await screen.findByRole("region", { name: "Preferências de privacidade" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recusar opcionais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceitar opcionais" })).toBeInTheDocument();
    expect(screen.getByText(/pode recusar sem perder acesso/i)).toBeInTheDocument();
  });

  it("reabre escolhas salvas pelo link do rodapé", async () => {
    window.localStorage.setItem(TRACKING_CONSENT_KEY, "rejected");
    render(<TrackingConsentBanner />);
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Preferências de privacidade" }),
      ).not.toBeInTheDocument(),
    );
    fireEvent(window, new Event(TRACKING_PREFERENCES_EVENT));
    expect(
      await screen.findByRole("region", { name: "Preferências de privacidade" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/somente necessários/i)).toBeInTheDocument();
  });

  it("não sobrepõe o checkout com banner de cookies", async () => {
    route.path = "/checkout";
    render(<TrackingConsentBanner />);
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Preferências de privacidade" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("permite reabrir explicitamente as preferências durante o checkout, sem exibir banner automático", async () => {
    route.path = "/checkout";
    window.localStorage.setItem(TRACKING_CONSENT_KEY, "accepted");
    render(<TrackingConsentBanner />);
    expect(
      screen.queryByRole("region", { name: "Preferências de privacidade" }),
    ).not.toBeInTheDocument();
    fireEvent(window, new Event(TRACKING_PREFERENCES_EVENT));
    const region = await screen.findByRole("region", { name: "Preferências de privacidade" });
    expect(region).toHaveTextContent(/opcionais ativados/i);
    expect(screen.getByRole("button", { name: "Recusar opcionais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceitar opcionais" })).toBeInTheDocument();
  });

  it("não inventa consentimento quando o navegador bloqueia a gravação", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    render(<TrackingConsentBanner />);
    fireEvent.click(await screen.findByRole("button", { name: "Aceitar opcionais" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /rastreamento opcional permanece desativado/i,
    );
    expect(hasTrackingConsent()).toBe(false);
  });
});

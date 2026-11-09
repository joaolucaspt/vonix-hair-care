import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: (args: unknown) => unknown) => fn }),
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
import { registerLead } from "@/lib/leads.functions";
import { SignupCoupon } from "@/components/signup-coupon";
const call = registerLead as unknown as (args: {
  data: { email: string; empresa?: string };
}) => Promise<{ ok: boolean; saved: boolean }>;

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("LEAD_WEBHOOK_URL", "");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("cadastro só confirma persistência", () => {
  it("ausência de integração não confirma nem registra dados em console", async () => {
    const info = vi.spyOn(console, "info");
    const error = vi.spyOn(console, "error");
    expect(await call({ data: { email: "teste@example.com" } })).toMatchObject({
      ok: false,
      saved: false,
    });
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    info.mockRestore();
    error.mockRestore();
  });
  it.each(["network", "http"])("falha %s não confirma", async (failure) => {
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://example.com/test");
    vi.stubGlobal(
      "fetch",
      failure === "network"
        ? vi.fn().mockRejectedValue(new Error("private error"))
        : vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    expect(await call({ data: { email: "teste@example.com" } })).toMatchObject({
      ok: false,
      saved: false,
    });
  });
  it("isca não envia cadastro", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await call({ data: { email: "teste@example.com", empresa: "bot" } })).toMatchObject({
      saved: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("interface não salva cupom nem emite Lead sem persistência, mesmo com marca antiga", async () => {
    localStorage.setItem("vonix-cadastro", "1");
    const gtag = vi.fn();
    vi.stubGlobal("gtag", gtag);
    window.gtag = gtag;
    render(<SignupCoupon />);
    fireEvent.change(screen.getByPlaceholderText("Seu e-mail"), {
      target: { value: "teste@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Quero meu cupom" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Cadastro feito!")).not.toBeInTheDocument();
    expect(localStorage.getItem("vonix-cadastro-confirmado-v2")).toBeNull();
    expect(gtag).not.toHaveBeenCalled();
  });
  it("confirma e entrega o cupom somente após salvar", async () => {
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://example.com/test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<SignupCoupon />);
    fireEvent.change(screen.getByPlaceholderText("Seu e-mail"), {
      target: { value: "teste@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Quero meu cupom" }));
    await screen.findByText("Cadastro feito!");
    await waitFor(() => expect(localStorage.getItem("vonix-cadastro-confirmado-v2")).toBe("1"));
  });
});

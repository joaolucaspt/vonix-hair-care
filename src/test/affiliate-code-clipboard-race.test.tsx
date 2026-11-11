import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => config,
}));
vi.mock("@/components/affiliate-shell", () => ({
  AffiliateShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/affiliate-functions", () => ({
  getAffiliateStatusByCode: vi.fn(),
}));
import { AffiliateTrackingCodePage } from "@/routes/consultar-candidatura";
const codeA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
const codeB = "abcdefghijklmnopqrstuvwxABCDEFGH";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Vonix tracking code clipboard privacy", () => {
  it("does not claim the new code was copied if a previous clipboard write resolves late", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const writeText = vi.fn().mockReturnValueOnce(pending);
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      render(<AffiliateTrackingCodePage />);
      const input = screen.getByLabelText("Código privado de acompanhamento");
      fireEvent.change(input, { target: { value: codeA } });
      fireEvent.click(screen.getByRole("button", { name: "Copiar código para guardar" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(codeA));
      fireEvent.change(input, { target: { value: codeB } });
      await act(async () => {
        finish();
        await pending;
      });
      expect(input).toHaveValue(codeB);
      expect(
        screen.getByRole("button", { name: "Copiar código para guardar" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Código copiado!" })).not.toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...rest
  }: React.PropsWithChildren<{ to: string; className?: string }>) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { AffiliateHomeInvite } from "@/components/affiliate-home-invite";

afterEach(cleanup);

describe("Vonix home affiliate invitation", () => {
  it("makes the five-stage affiliate route discoverable without competing with sales", () => {
    render(<AffiliateHomeInvite />);

    const section = screen.getByTestId("vonix-affiliate-home-invite");
    expect(section).toHaveAttribute("aria-labelledby", "vonix-afiliadas-convite-titulo");
    expect(screen.getByRole("link", { name: /Conhecer o programa de afiliadas/i })).toHaveAttribute(
      "href",
      "/seja-afiliada",
    );
    expect(section).toHaveTextContent(/A inscrição é gratuita e a seleção não é automática/);
    expect(section).not.toHaveTextContent(
      /comissão garantida|desconto de R\$|Skence|receba produtos grátis/i,
    );
  });
});

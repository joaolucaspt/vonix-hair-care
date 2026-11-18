import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AffiliateSellingFlow } from "@/components/affiliate-selling-flow";
import { AffiliateLandingIntro, AffiliateLandingFAQ } from "@/components/affiliate-landing";

afterEach(() => cleanup());

describe("C57 premium Vonix affiliate conversion and brand accuracy", () => {
  it("explains the three verified operational stages with only official Vonix catalog products", () => {
    render(<AffiliateSellingFlow recruitmentOpen />);
    const flow = screen.getByTestId("vonix-c57-selling-flow");
    expect(within(flow).getByText("Seu conteúdo. Seu link.")).toBeInTheDocument();
    expect(within(flow).getByText("A cliente compra na Vonix.")).toBeInTheDocument();
    expect(within(flow).getByText("Sua comissão pode acontecer.")).toBeInTheDocument();
    expect(within(flow).getByText(/8%/)).toBeInTheDocument();
    expect(within(flow).getByText(/nenhum link ou comissão é liberado/i)).toBeInTheDocument();
    expect(within(flow).getByRole("link", { name: /Quero me candidatar/ })).toHaveAttribute(
      "href",
      "#inscricao",
    );
    const images = within(flow).getAllByRole("img") as HTMLImageElement[];
    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(image.getAttribute("src")).toMatch(/^\/images\/products\/.+\.jpg$/);
      expect(image.getAttribute("alt")).toContain("Vonix Hair");
      expect(image.getAttribute("loading")).toBe("lazy");
    }
    expect(flow.textContent).not.toMatch(/15%|21%|PIX no dia 10|receba produtos grátis/);
  });

  it("does not advertise a live enrollment CTA when recruitment is disabled", () => {
    render(<AffiliateSellingFlow recruitmentOpen={false} />);
    const flow = screen.getByTestId("vonix-c57-selling-flow");
    expect(within(flow).getByRole("link", { name: /Conhecer a inscrição/ })).toHaveAttribute(
      "href",
      "#inscricao",
    );
    expect(within(flow).queryByRole("link", { name: /Quero me candidatar/ })).toBeNull();
  });

  it("promotes realistic conditions from the official Vonix program, not the reference brand", () => {
    render(
      <>
        <AffiliateLandingIntro recruitmentStatus="closed" />
        <AffiliateLandingFAQ />
      </>,
    );
    expect(screen.getByTestId("vonix-affiliate-hero")).toHaveTextContent(
      "8% sobre vendas após aprovação",
    );
    expect(screen.getByTestId("vonix-affiliate-hero")).toHaveTextContent("Sem estoque próprio");
    expect(screen.getByTestId("vonix-affiliate-faq")).toHaveTextContent(
      "E-mail é obrigatório para se candidatar?",
    );
    expect(screen.getByTestId("vonix-affiliate-faq")).toHaveTextContent(
      "Sim. Para enviar uma nova candidatura",
    );
    expect(screen.queryByText(/Skence Creators|15% no site|21% no TikTok Shop/)).toBeNull();
  });
});

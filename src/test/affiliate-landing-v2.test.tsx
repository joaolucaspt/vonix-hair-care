import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AffiliateLandingIntro, AffiliateLandingFAQ } from "@/components/affiliate-landing";

afterEach(cleanup);

describe("Vonix affiliate V2 editorial journey", () => {
  it("keeps the mobile galleries keyboard-accessible and swipeable, without importing third-party claims", () => {
    render(<AffiliateLandingIntro recruitmentStatus="closed" />);
    const topics = screen.getByRole("region", { name: /Temas da seleção Vonix Hair/ });
    const ideas = screen.getByRole("region", { name: /Formatos criativos ilustrados/ });
    expect(topics).toHaveAttribute("tabindex", "0");
    expect(ideas).toHaveAttribute("tabindex", "0");
    expect(topics.className).toContain("snap-x");
    expect(ideas.className).toContain("snap-x");
    expect(within(ideas).getAllByRole("article")).toHaveLength(4);
    expect(screen.getByTestId("vonix-affiliate-hero")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", {
        name: /Conhecer a inscrição|Visualizar formulário|Conhecer a candidatura/i,
      }).length,
    ).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(
      /Skence|Pliv Pro|3 milhões|21% de comissão|PIX no dia 10/i,
    );
  });

  it("preserves six independent, native and accessible FAQ disclosures", () => {
    render(<AffiliateLandingFAQ />);
    const faq = screen.getByTestId("vonix-affiliate-faq");
    expect(faq.querySelectorAll("details")).toHaveLength(6);
    expect(within(faq).getAllByText(/Quem pode apresentar uma candidatura/i)).toHaveLength(1);
  });
});

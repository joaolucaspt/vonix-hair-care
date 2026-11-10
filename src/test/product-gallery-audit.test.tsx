import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProductGallery } from "@/components/product-gallery";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

const gallery = (
  <ProductGallery
    name="Kit Banana e Mel"
    images={["/images/kit-frente.webp", "/images/kit-verso.webp"]}
  />
);

describe("galeria de produto: zoom acessível e miniaturas", () => {
  it("usa botão nativo de foto sem botões aninhados e miniaturas com estado", () => {
    render(gallery);
    const opener = screen.getByRole("button", {
      name: "Ampliar imagem de Kit Banana e Mel, 1 de 2",
    });
    expect(opener.querySelector("button")).toBeNull();
    const first = screen.getByRole("button", { name: "Ver imagem 1 de 2 de Kit Banana e Mel" });
    const second = screen.getByRole("button", { name: "Ver imagem 2 de 2 de Kit Banana e Mel" });
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Ampliar imagem de Kit Banana e Mel, 2 de 2" }),
    ).toBeInTheDocument();
  });

  it("coloca foco no Fechar e restaura foco/scroll após Escape", () => {
    render(gallery);
    const opener = screen.getByRole("button", {
      name: "Ampliar imagem de Kit Banana e Mel, 1 de 2",
    });
    fireEvent.click(opener);
    const modal = screen.getByRole("dialog", { name: "Kit Banana e Mel: imagem ampliada" });
    expect(modal).toHaveAttribute("aria-modal", "true");
    expect(within(modal).getByRole("button", { name: "Fechar" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(modal).getByText(/2 de 2/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });
});

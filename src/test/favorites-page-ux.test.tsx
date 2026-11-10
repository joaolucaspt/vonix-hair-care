import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ favs: [] as string[] }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/components/site", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Grid: ({ items }: { items: unknown[] }) => <div data-testid="favorites-grid">{items.length}</div>,
}));
vi.mock("@/lib/store", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useFavorites: () => ({ favs: mocks.favs }),
}));

import { Route } from "@/routes/favoritos";
const FavoritesPage = (Route as unknown as { options: { component: React.ComponentType } }).options
  .component;

beforeEach(() => {
  mocks.favs = [];
});
afterEach(() => cleanup());

describe("tela Favoritos orienta a compra com clareza", () => {
  it("mostra um estado vazio com caminho visível e acessível para explorar a loja", () => {
    render(<FavoritesPage />);
    expect(screen.getByRole("heading", { name: "Favoritos", level: 1 })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sua lista de favoritos está vazia" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar produtos" })).toHaveAttribute(
      "href",
      "/loja",
    );
    expect(screen.queryByTestId("favorites-grid")).not.toBeInTheDocument();
  });

  it("mostra quantidade de produtos salvos no navegador quando há favoritos", () => {
    mocks.favs = ["kit-banana-e-mel"];
    render(<FavoritesPage />);
    expect(screen.getByRole("status")).toHaveTextContent("1 produto salvo");
    expect(screen.getByTestId("favorites-grid")).toHaveTextContent("1");
    expect(
      screen.queryByRole("heading", { name: "Sua lista de favoritos está vazia" }),
    ).not.toBeInTheDocument();
  });
});

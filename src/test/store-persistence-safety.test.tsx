import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  getProduct,
  migrateFavorites,
  migrateAudience,
  useFavorites,
  useCart,
  useAudience,
} from "@/lib/store";

afterEach(() => {
  cleanup();
  localStorage.removeItem("vonix-favs");
  localStorage.removeItem("vonix-cart");
  sessionStorage.removeItem("vonix-audience");
});

function FavoritesView() {
  const favorites = useFavorites();
  return (
    <main>
      <output data-testid="favorite-count">{favorites.favs.length}</output>
      <output data-testid="favorite-has-banana">{String(favorites.has("kit-banana-e-mel"))}</output>
      <button onClick={() => favorites.toggle("kit-banana-e-mel")}>Alternar favorito</button>
    </main>
  );
}

function AudienceView() {
  const audience = useAudience();
  return (
    <main>
      <output data-testid="audience">{audience.audience ?? "none"}</output>
      <button onClick={() => audience.set("salao")}>Escolher salão</button>
    </main>
  );
}

function CartView() {
  const cart = useCart();
  return (
    <main>
      <output data-testid="cart-count">{cart.count}</output>
      <output data-testid="cart-lines">{cart.lines.length}</output>
    </main>
  );
}

describe("validação e sincronização do armazenamento público da loja", () => {
  it("ignora favoritos corrompidos, indisponíveis, duplicados e entradas arbitrárias", () => {
    expect(migrateFavorites({ invalid: true })).toEqual([]);
    expect(
      migrateFavorites(["kit-banana-e-mel", "plex-vonix", "kit-banana-e-mel", 42, null, "unknown"]),
    ).toEqual(["kit-banana-e-mel"]);
    expect(migrateAudience({ value: "salao" })).toBeNull();
    expect(migrateAudience("desconhecido")).toBeNull();
    expect(migrateAudience("salao")).toBe("salao");
  });

  it("recupera favoritos de localStorage adulterado sem quebrar a vitrine", () => {
    localStorage.setItem("vonix-favs", JSON.stringify({ notAnArray: true }));
    render(<FavoritesView />);
    expect(screen.getByTestId("favorite-count")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: "Alternar favorito" }));
    expect(screen.getByTestId("favorite-has-banana")).toHaveTextContent("true");
    expect(JSON.parse(localStorage.getItem("vonix-favs") ?? "null")).toEqual(["kit-banana-e-mel"]);
  });

  it("sincroniza favoritos alterados em outra aba e ignora produtos aposentados", () => {
    render(<FavoritesView />);
    const raw = JSON.stringify(["kit-banana-e-mel", "plex-vonix", "kit-banana-e-mel"]);
    localStorage.setItem("vonix-favs", raw);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "vonix-favs",
          newValue: raw,
          storageArea: localStorage,
        }),
      );
    });
    expect(screen.getByTestId("favorite-count")).toHaveTextContent("1");
    expect(screen.getByTestId("favorite-has-banana")).toHaveTextContent("true");
  });

  it("limpa os favoritos após armazenamento inválido ou limpeza em outra aba", () => {
    render(<FavoritesView />);
    const initial = JSON.stringify(["kit-banana-e-mel"]);
    localStorage.setItem("vonix-favs", initial);
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "vonix-favs",
          newValue: initial,
          storageArea: localStorage,
        }),
      ),
    );
    expect(screen.getByTestId("favorite-count")).toHaveTextContent("1");

    localStorage.setItem("vonix-favs", "{");
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "vonix-favs",
          newValue: "{",
          storageArea: localStorage,
        }),
      ),
    );
    expect(screen.getByTestId("favorite-count")).toHaveTextContent("0");

    localStorage.setItem("vonix-favs", initial);
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "vonix-favs",
          newValue: initial,
          storageArea: localStorage,
        }),
      ),
    );
    localStorage.removeItem("vonix-favs");
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: null,
          newValue: null,
          storageArea: localStorage,
        }),
      ),
    );
    expect(screen.getByTestId("favorite-count")).toHaveTextContent("0");
  });

  it("nunca usa público inválido guardado na sessão como classificação do catálogo", () => {
    sessionStorage.setItem("vonix-audience", JSON.stringify({ malicious: true }));
    render(<AudienceView />);
    expect(screen.getByTestId("audience")).toHaveTextContent("none");
    fireEvent.click(screen.getByRole("button", { name: "Escolher salão" }));
    expect(screen.getByTestId("audience")).toHaveTextContent("salao");
    expect(sessionStorage.getItem("vonix-audience")).toBe('"salao"');
  });

  it("atualiza a sacola em outra aba sem perder descontos calculados na loja", () => {
    const product = getProduct("kit-banana-e-mel")!;
    const first = [{ slug: product.slug, variant: product.variants[0].label, qty: 1 }];
    const updated = [{ slug: product.slug, variant: product.variants[0].label, qty: 3 }];
    localStorage.setItem("vonix-cart", JSON.stringify(first));
    render(<CartView />);
    expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
    localStorage.setItem("vonix-cart", JSON.stringify(updated));
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "vonix-cart",
          newValue: JSON.stringify(updated),
          storageArea: localStorage,
        }),
      );
    });
    expect(screen.getByTestId("cart-count")).toHaveTextContent("3");
    expect(screen.getByTestId("cart-lines")).toHaveTextContent("1");
  });
});

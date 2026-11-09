import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewCard, type Review } from "@/components/reviews";

const review: Review = {
  slug: "progressiva-fio-de-luz",
  author: "Cliente Teste",
  rating: 5,
  comment: "Amei o resultado",
  date: "2026-09-01",
  media: { type: "video", src: "/depoimentos/teste.mp4", poster: "/depoimentos/teste.jpg" },
};

describe("ReviewCard com vídeo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("só renderiza o vídeo quando o cartão chega perto da tela", () => {
    let trigger: (visible: boolean) => void = () => undefined;
    const options: IntersectionObserverInit[] = [];
    class FakeObserver {
      constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
        options.push(opts ?? {});
        trigger = (visible) =>
          cb([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    const { container } = render(<ReviewCard r={review} />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector(".aspect-\\[3\\/4\\].bg-black")).not.toBeNull();
    expect(options[0]?.rootMargin).toBe("400px");

    act(() => trigger(true));
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("poster")).toBe("/depoimentos/teste.jpg");
  });

  it("sem IntersectionObserver, renderiza o vídeo na hora", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<ReviewCard r={review} />);
    expect(container.querySelector("video")).not.toBeNull();
  });
});

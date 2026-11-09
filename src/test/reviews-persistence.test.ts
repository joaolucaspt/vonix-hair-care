import { beforeEach, describe, expect, it, vi } from "vitest";
const values = vi.hoisted(() => ({ webhook: "" }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: unknown) => fn }),
    handler: (fn: unknown) => fn,
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => "" }));
vi.mock("@/lib/env.server", () => ({
  env: (key: string) => (key === "REVIEW_WEBHOOK_URL" ? values.webhook : ""),
}));
vi.mock("@/lib/reviews.server", () => ({
  dbEnabled: () => false,
  countRecent: vi.fn(),
  insertReview: vi.fn(),
  listApproved: vi.fn(),
  summaryApproved: vi.fn(),
}));
import { submitReview } from "@/lib/reviews.functions";

const input = {
  slug: "botox-vonix",
  nome: "Comprador Teste",
  nota: 5,
  comentario: "Gostei do produto e da embalagem.",
  email: "teste@example.com",
};
beforeEach(() => {
  values.webhook = "";
  vi.restoreAllMocks();
});

describe("never pretend a review was saved when persistence failed", () => {
  it("without a destination, returns failure instead of logging a review with PII", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const result = await submitReview({ data: input });
    expect(result).toMatchObject({ ok: false, publicada: false });
    expect(spy).not.toHaveBeenCalled();
  });
  it("on webhook failure, does not acknowledge a review or log PII", async () => {
    values.webhook = "https://reviews.example/ingest";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await submitReview({ data: input });
    expect(result).toMatchObject({ ok: false, publicada: false });
    expect(spy).not.toHaveBeenCalled();
  });
  it("acknowledges only a successful destination response", async () => {
    values.webhook = "https://reviews.example/ingest";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    expect(await submitReview({ data: input })).toMatchObject({ ok: true, publicada: false });
  });
});

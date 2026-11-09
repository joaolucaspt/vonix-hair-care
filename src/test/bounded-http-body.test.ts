import { describe, expect, it } from "vitest";
import { readTextBounded, BodyLimitError } from "@/lib/bounded-http-body";

describe("safe webhook body reader", () => {
  const make = (body: string) =>
    new Request("https://test.example/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

  it("reads normal JSON without corrupting Unicode characters", async () => {
    const payload = JSON.stringify({ event: "order_paid", produto: "Máscara Nutrição" });
    expect(await readTextBounded(make(payload))).toBe(payload);
  });

  it("counts bytes, not JavaScript characters, for UTF-8 size limits", async () => {
    const multibyte = JSON.stringify({ message: "é".repeat(9_000) });
    // 9000 characters are already over the 16384-byte webhook limit in UTF-8.
    expect(multibyte.length).toBeLessThan(16_384);
    await expect(readTextBounded(make(multibyte))).rejects.toMatchObject({ kind: "too_large" });
  });

  it("rejects malformed Content-Length values without attempting a read", async () => {
    const request = make("{}");
    request.headers.set("content-length", "not-a-number");
    await expect(readTextBounded(request)).rejects.toBeInstanceOf(BodyLimitError);
  });

  it("does not wait forever for a client stream that never completes", async () => {
    const stalled = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
    });
    const request = new Request("https://test.example/webhook", {
      method: "POST",
      body: stalled,
      duplex: "half",
    } as RequestInit);
    await expect(readTextBounded(request, 16_384, 30)).rejects.toMatchObject({ kind: "timeout" });
  });
});

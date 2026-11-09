/** Read webhook bodies without buffering unbounded request data.
 * The timeout keeps the public endpoint within the provider's retry window.
 */
export class BodyLimitError extends Error {
  constructor(public readonly kind: "too_large" | "timeout") {
    super(kind);
  }
}

export async function readTextBounded(
  request: Request,
  maxBytes = 16_384,
  maxMs = 1_000,
): Promise<string> {
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes)
      throw new BodyLimitError("too_large");
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const deadline = Date.now() + maxMs;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new BodyLimitError("timeout");
      let timer: ReturnType<typeof setTimeout> | undefined;
      const item = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new BodyLimitError("timeout")), remaining);
        }),
      ]).finally(() => {
        if (timer) clearTimeout(timer);
      });
      if (item.done) break;
      size += item.value.byteLength;
      if (size > maxBytes) throw new BodyLimitError("too_large");
      chunks.push(item.value);
    }
    const all = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(all);
  } catch (error) {
    // Do not wait for an untrusted/slow client stream to finish.
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    // A timeout may leave a pending read while cancellation propagates.
    try {
      reader.releaseLock();
    } catch {
      /* cancellation is already requested */
    }
  }
}

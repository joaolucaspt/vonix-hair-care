import { z } from "zod";

export const cepInput = z.object({ cep: z.string().regex(/^\d{8}$/) });
const addressSchema = z.object({
  street: z.string().max(160),
  district: z.string().max(100),
  city: z.string().min(1).max(100),
  uf: z.string().regex(/^[A-Z]{2}$/),
});
export type AddressResult =
  { ok: true; address: z.infer<typeof addressSchema> } | { ok: false; message: string };

/** Public postal data only; fixed providers, bounded requests, no logging. */
export async function fetchAddress(cep: string): Promise<AddressResult> {
  if (!cepInput.safeParse({ cep }).success) {
    return { ok: false, message: "Digite um CEP válido com 8 dígitos." };
  }
  const providers = [
    { url: `https://viacep.com.br/ws/${cep}/json/`, secondary: false },
    { url: `https://brasilapi.com.br/api/cep/v1/${cep}`, secondary: true },
  ];
  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) continue;
      const json: unknown = await response.json();
      if (!json || typeof json !== "object") continue;
      const r = json as Record<string, unknown>;
      if (r["erro"]) continue;
      const returnedCep = r["cep"];
      if (typeof returnedCep !== "string" || returnedCep.replace(/\D/g, "") !== cep) continue;
      const parsed = addressSchema.safeParse({
        street: (provider.secondary ? r["street"] : r["logradouro"]) ?? "",
        district: (provider.secondary ? r["neighborhood"] : r["bairro"]) ?? "",
        city: provider.secondary ? r["city"] : r["localidade"],
        uf: provider.secondary ? r["state"] : r["uf"],
      });
      if (parsed.success) return { ok: true, address: parsed.data };
    } catch {
      // Timeout, network errors and malformed JSON all try the next provider.
    }
  }
  return {
    ok: false,
    message:
      "Não foi possível localizar o endereço deste CEP. Preencha manualmente; o cálculo de frete continua independente.",
  };
}

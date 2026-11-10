import { afterEach, describe, expect, it, vi } from "vitest";
import { cepInput, fetchAddress } from "@/lib/address.server";

afterEach(() => vi.unstubAllGlobals());
const primary = (cep: string) => ({
  cep,
  logradouro: "Rua",
  bairro: "Centro",
  localidade: "Cidade",
  uf: "MG",
});
const response = (json: unknown) => ({ ok: true, json: async () => json });

describe("consulta de CEP pública no servidor", () => {
  it.each(["30140010", "01310100", "69005070"])("aceita e consulta %s", async (cep) => {
    const fetch = vi.fn().mockResolvedValue(response(primary(cep)));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchAddress(cep)).toEqual({
      ok: true,
      address: { street: "Rua", district: "Centro", city: "Cidade", uf: "MG" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1].signal).toBeDefined();
  });
  it.each(["", "123", "30140-010", "abcdefgh"])("rejeita %s sem requisição", async (cep) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(cepInput.safeParse({ cep }).success).toBe(false);
    expect((await fetchAddress(cep)).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["network", "timeout", "http", "malformed", "notfound", "different-cep"])(
    "usa alternativa após %s",
    async (failure) => {
      const fetch = vi.fn();
      if (failure === "network" || failure === "timeout")
        fetch.mockRejectedValueOnce(new Error(failure));
      else
        fetch.mockResolvedValueOnce(
          failure === "http"
            ? { ok: false }
            : response(
                failure === "notfound"
                  ? { erro: true }
                  : failure === "different-cep"
                    ? primary("01310100")
                    : { cep: "30140010", localidade: 123 },
              ),
        );
      fetch.mockResolvedValueOnce(
        response({
          cep: "30140010",
          street: "Av",
          neighborhood: "Centro",
          city: "BH",
          state: "MG",
        }),
      );
      vi.stubGlobal("fetch", fetch);
      expect(await fetchAddress("30140010")).toEqual({
        ok: true,
        address: { street: "Av", district: "Centro", city: "BH", uf: "MG" },
      });
      expect(fetch.mock.calls[1]?.[0]).toBe("https://brasilapi.com.br/api/cep/v1/30140010");
    },
  );
  it("não preenche endereço com UF inexistente e consulta o segundo provedor", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ ...primary("30140010"), uf: "ZZ" }))
      .mockResolvedValueOnce(
        response({
          cep: "30140010",
          street: "Avenida Válida",
          neighborhood: "Centro",
          city: "Belo Horizonte",
          state: "MG",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchAddress("30140010")).toEqual({
      ok: true,
      address: {
        street: "Avenida Válida",
        district: "Centro",
        city: "Belo Horizonte",
        uf: "MG",
      },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("não usa cidade composta só de espaços e consulta o segundo provedor", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ ...primary("30140010"), localidade: "   " }))
      .mockResolvedValueOnce(
        response({
          cep: "30140010",
          street: "Rua Válida",
          neighborhood: "Centro",
          city: "Belo Horizonte",
          state: "MG",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await fetchAddress("30140010")).toEqual({
      ok: true,
      address: { street: "Rua Válida", district: "Centro", city: "Belo Horizonte", uf: "MG" },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejeita UF falsa mesmo quando as duas fontes devolvem estado inválido", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ ...primary("30140010"), uf: "ZZ" }))
      .mockResolvedValueOnce(
        response({
          cep: "30140010",
          street: "Rua",
          neighborhood: "Centro",
          city: "Cidade",
          state: "XX",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await fetchAddress("30140010");
    expect(result.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retorna resposta segura para falha de ambos e JSON inválido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => {
          throw new Error("internal details");
        },
      }),
    );
    const result = await fetchAddress("30140010");
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("internal details");
  });
});

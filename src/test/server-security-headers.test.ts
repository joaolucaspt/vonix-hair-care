import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServer = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch: mockServer.fetch },
}));

import server, { fallbackErrorResponse } from "@/server";

describe("cabeçalhos de segurança em respostas normais e de erro", () => {
  beforeEach(() => mockServer.fetch.mockReset());

  it("preserva proteções na resposta HTTP 200", async () => {
    mockServer.fetch.mockResolvedValue(new Response("ok", { status: 200 }));
    const response = await server.fetch(new Request("https://vonixhair.com/"), {}, {});
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("a resposta de fallback usada na captura de erros SSR também preserva proteções", async () => {
    const response = fallbackErrorResponse();
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("Não foi possível carregar a página");
  });
});

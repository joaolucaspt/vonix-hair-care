import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savePendingCard } from "@/lib/pending-card";
import { savePendingPix } from "@/lib/pending-pix";

const mocks = vi.hoisted(() => ({ status: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/site", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Page: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/checkout.functions", () => ({ getOrderStatus: mocks.status }));
import { Route as AccountRoute } from "@/routes/conta";
import { Route as FavoritesRoute } from "@/routes/favoritos";
const Account = (AccountRoute as unknown as { options: { component: React.ComponentType } }).options
  .component;

const token = "signed-test-only-capability-of-sufficient-length";
const pendingCard = (orderId = 701) => ({
  orderId,
  statusToken: token,
  total: 154.9,
  paid: false,
  status: "autorizado",
});

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  mocks.status.mockResolvedValue({ ok: true, paid: false, status: "pendente" });
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("Meus pedidos sem cadastro e sem cobranças", () => {
  it("impede indexação de área de pedidos e favoritos locais, sem expor sessão a robôs de busca", () => {
    const head = (route: unknown) =>
      (
        route as {
          options: { head: () => { meta: Array<{ name?: string; content: string }> } };
        }
      ).options.head().meta;
    expect(head(AccountRoute)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "robots", content: "noindex, nofollow" }),
      ]),
    );
    expect(head(FavoritesRoute)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "robots", content: "noindex, nofollow" }),
      ]),
    );
  });

  it("não promete encontrar compras antigas nem expõe dados privados", async () => {
    render(<Account />);
    expect(
      await screen.findByText(/Nenhum pedido recente disponível nesta aba/),
    ).toBeInTheDocument();
    expect(screen.getByText(/pedidos antigos, compras em outro aparelho/)).toBeInTheDocument();
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it("consulta um cartão pendente somente com token assinado da sessão", async () => {
    savePendingCard(pendingCard());
    const view = render(<Account />);
    expect(await screen.findByText("Pedido nº 701")).toBeInTheDocument();
    expect(screen.getByText("Pagamento: Cartão")).toBeInTheDocument();
    expect(view.container.innerHTML).not.toContain(token);
    expect(mocks.status).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Consultar pedido 701" }));
    await waitFor(() =>
      expect(mocks.status).toHaveBeenCalledWith({
        data: { orderId: 701, statusToken: token },
      }),
    );
    expect(await screen.findByText(/Pagamento ainda não confirmado/)).toBeInTheDocument();
    expect(view.container.innerHTML).not.toContain(token);
  });

  it("não identifica indevidamente como cartão um pagamento anterior de método desconhecido", async () => {
    savePendingCard({ ...pendingCard(710), verificationOnly: true });
    render(<Account />);
    expect(await screen.findByText("Pedido nº 710")).toBeInTheDocument();
    expect(screen.getByText("Pagamento: Não confirmado")).toBeInTheDocument();
    expect(screen.queryByText("Pagamento: Cartão")).not.toBeInTheDocument();
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it("não anuncia pagamento aprovado por flag paid:true adulterada na sessão", async () => {
    savePendingCard({ ...pendingCard(712), paid: true, status: "aprovado" });
    render(<Account />);
    expect(await screen.findByText("Pedido nº 712")).toBeInTheDocument();
    expect(screen.queryByText(/Pagamento confirmado pela Appmax/)).not.toBeInTheDocument();
    expect(screen.getByText(/status ainda precisa ser consultado/)).toBeInTheDocument();
    expect(mocks.status).not.toHaveBeenCalled();

    mocks.status.mockResolvedValueOnce({ ok: true, paid: false, status: "aguardando_confirmacao" });
    fireEvent.click(screen.getByRole("button", { name: "Consultar pedido 712" }));
    expect(await screen.findByText(/Pagamento ainda não confirmado/)).toBeInTheDocument();
    expect(screen.queryByText(/Pagamento confirmado pela Appmax/)).not.toBeInTheDocument();

    mocks.status.mockResolvedValueOnce({ ok: true, paid: true, status: "aprovado" });
    fireEvent.click(screen.getByRole("button", { name: "Consultar pedido 712" }));
    expect(await screen.findByText(/Pagamento confirmado pela Appmax/)).toBeInTheDocument();
    expect(mocks.status).toHaveBeenCalledTimes(2);
  });

  it("não envia consultas concorrentes ao clicar duas vezes durante resposta pendente", async () => {
    savePendingCard(pendingCard(714));
    let finish: ((result: { ok: boolean; paid: boolean; status: string }) => void) | undefined;
    mocks.status.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<Account />);
    const button = await screen.findByRole("button", { name: "Consultar pedido 714" });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(mocks.status).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    await act(async () => {
      finish?.({ ok: true, paid: false, status: "pendente" });
    });
    expect(await screen.findByText(/Pagamento ainda não confirmado/)).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("mostra pagamento aprovado somente após resposta autenticada", async () => {
    savePendingPix({
      orderId: 702,
      statusToken: token,
      total: 120,
      emv: "mock-qr",
      qrcode: "mock-image",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    mocks.status.mockResolvedValue({ ok: true, paid: true, status: "aprovado" });
    render(<Account />);
    fireEvent.click(await screen.findByRole("button", { name: "Consultar pedido 702" }));
    expect(await screen.findByText(/Pagamento confirmado pela Appmax/)).toBeInTheDocument();
    expect(screen.getByText("Pagamento: Pix")).toBeInTheDocument();
  });

  it("não convida pagar novamente após recusa ou erro de conexão", async () => {
    savePendingCard(pendingCard());
    mocks.status.mockResolvedValueOnce({ ok: true, paid: false, status: "cancelado" });
    mocks.status.mockRejectedValueOnce(new Error("network"));
    render(<Account />);
    fireEvent.click(await screen.findByRole("button", { name: "Consultar pedido 701" }));
    expect(await screen.findByText(/esta tentativa foi encerrada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Consultar pedido 701" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/antes de tentar pagar novamente/);
  });

  it("mostra no máximo um card por pedido, mesmo com sessões Pix e cartão duplicadas", async () => {
    savePendingCard(pendingCard(703));
    savePendingPix({
      orderId: 703,
      statusToken: token,
      total: 100,
      emv: "synthetic",
      qrcode: "synthetic",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    render(<Account />);
    expect(await screen.findAllByText("Pedido nº 703")).toHaveLength(1);
  });

  it("não bloqueia o atendimento quando a consulta do servidor nega o token", async () => {
    savePendingCard(pendingCard());
    mocks.status.mockResolvedValueOnce({ ok: false });
    render(<Account />);
    fireEvent.click(await screen.findByRole("button", { name: "Consultar pedido 701" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Consulte o atendimento/);
    expect(mocks.status).toHaveBeenCalledTimes(1);
  });
});

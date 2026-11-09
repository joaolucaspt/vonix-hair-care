import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNCERTAIN_PAYMENT_KEY,
  clearUncertainPayment,
  recoverUncertainPayment,
  rememberPaymentAttempt,
} from "@/lib/uncertain-payment";

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("reserva conservadora de tentativa de pagamento sem resposta", () => {
  it("persiste somente método e horário, sem CPF, cartão, endereço ou pedido", () => {
    expect(recoverUncertainPayment()).toBeNull();
    rememberPaymentAttempt("pix", 1000);
    expect(recoverUncertainPayment(1500)).toEqual({ method: "pix", startedAt: 1000 });
    expect(JSON.parse(sessionStorage.getItem(UNCERTAIN_PAYMENT_KEY)!)).toEqual({
      method: "pix", startedAt: 1000,
    });
    clearUncertainPayment();
    expect(recoverUncertainPayment()).toBeNull();
  });

  it("rejeita marcador adulterado, incompleto, do futuro e expirado", () => {
    for (const bad of ["{", '{"method":"cash","startedAt":1000}', '{"method":"pix"}', '{"method":"card","startedAt":"1000"}']) {
      sessionStorage.setItem(UNCERTAIN_PAYMENT_KEY, bad);
      expect(recoverUncertainPayment(1001)).toBeNull();
    }
    rememberPaymentAttempt("card", 1000);
    expect(recoverUncertainPayment(999)).toBeNull();
    expect(recoverUncertainPayment(1000 + 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("não causa exceções se o navegador impedir sessionStorage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => rememberPaymentAttempt("card")).not.toThrow();
    expect(recoverUncertainPayment()).toBeNull();
    expect(() => clearUncertainPayment()).not.toThrow();
  });
});

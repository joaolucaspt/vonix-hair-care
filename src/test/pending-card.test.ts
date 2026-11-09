import { beforeEach, describe, expect, it } from "vitest";
import {
  PENDING_CARD_KEY,
  clearPendingCard,
  restorePendingCard,
  savePendingCard,
  pendingPaymentFromResponse,
  type PendingCard,
} from "@/lib/pending-card";

const card: PendingCard = {
  orderId: 981,
  statusToken: "signed-read-only-test-token-0000001",
  total: 154.9,
  paid: false,
  status: "autorizado",
};
beforeEach(() => sessionStorage.clear());

describe("pending card verification is resumable, not a new payment", () => {
  it("retains the payment-method-neutral verification state for a Pix without a QR code", () => {
    const pending = pendingPaymentFromResponse({
      ...card,
      method: "verification",
      status: "aguardando_confirmacao",
    });
    expect(pending.verificationOnly).toBe(true);
    savePendingCard(pending, 1000);
    expect(restorePendingCard(1500)).toEqual(pending);
    expect(JSON.stringify(restorePendingCard(1500))).not.toContain("card number");
  });
  it("keeps ordinary card authorizations labeled as card, without inventing Pix status", () => {
    const pending = pendingPaymentFromResponse({ ...card, method: "card" });
    expect(pending).not.toHaveProperty("verificationOnly");
    savePendingCard(pending, 1000);
    expect(restorePendingCard(1100)).not.toHaveProperty("verificationOnly");
  });
  it("rejects a forged verificationOnly type in session storage", () => {
    savePendingCard({ ...card, verificationOnly: true }, 1000);
    const raw = JSON.parse(sessionStorage.getItem(PENDING_CARD_KEY)!);
    sessionStorage.setItem(PENDING_CARD_KEY, JSON.stringify({ ...raw, verificationOnly: "false" }));
    expect(restorePendingCard(1001)).toBeNull();
  });
  it("restores the same order ID and token within the existing browser session", () => {
    savePendingCard(card, 1000);
    expect(restorePendingCard(1500)).toEqual(card);
    expect(sessionStorage.getItem(PENDING_CARD_KEY)).not.toContain("529");
    expect(sessionStorage.getItem(PENDING_CARD_KEY)).not.toContain("credit_card");
  });
  it("expires after 24 hours and clears stale capabilities", () => {
    const epoch = 1_700_000_000_000;
    savePendingCard(card, epoch);
    expect(restorePendingCard(epoch + 23 * 60 * 60 * 1000)).toEqual(card);
    expect(restorePendingCard(epoch + 24 * 60 * 60 * 1000)).toBeNull();
    expect(sessionStorage.getItem(PENDING_CARD_KEY)).toBeNull();
  });
  it("rejects manipulated IDs, invalid tokens and future timestamps", () => {
    savePendingCard(card, 1000);
    const raw = JSON.parse(sessionStorage.getItem(PENDING_CARD_KEY)!);
    sessionStorage.setItem(PENDING_CARD_KEY, JSON.stringify({ ...raw, orderId: -8 }));
    expect(restorePendingCard(1010)).toBeNull();
    savePendingCard(card, 1000);
    sessionStorage.setItem(PENDING_CARD_KEY, JSON.stringify({ ...raw, statusToken: "" }));
    expect(restorePendingCard(1010)).toBeNull();
    savePendingCard(card, 1000);
    expect(restorePendingCard(999)).toBeNull();
  });
  it("clears explicitly after payment resolution", () => {
    savePendingCard(card);
    clearPendingCard();
    expect(restorePendingCard()).toBeNull();
  });
  it("handles corrupt session storage without crashing checkout", () => {
    sessionStorage.setItem(PENDING_CARD_KEY, "{invalid");
    expect(restorePendingCard()).toBeNull();
    expect(sessionStorage.getItem(PENDING_CARD_KEY)).toBeNull();
  });
});

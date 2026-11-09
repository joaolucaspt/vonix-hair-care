import { beforeEach, describe, expect, it } from "vitest";
import {
  PENDING_CARD_KEY,
  clearPendingCard,
  restorePendingCard,
  savePendingCard,
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

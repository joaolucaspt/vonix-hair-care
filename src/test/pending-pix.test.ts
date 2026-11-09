import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingPix,
  PENDING_PIX_KEY,
  restorePendingPix,
  savePendingPix,
  type PendingPix,
} from "@/lib/pending-pix";

const pix: PendingPix = {
  orderId: 2040,
  statusToken: "signed-read-only-test-token-0000003",
  total: 154.9,
  emv: "00020126890014br.gov.bcb.pix0111test-only",
  qrcode: "dGVzdC1vbmNl",
  expiresAt: "2027-01-01 12:00:00",
};

beforeEach(() => sessionStorage.clear());
describe("Pix verification survives a page reload in the same session", () => {
  it("restores the original QR and reference without creating a second order", () => {
    savePendingPix(pix, 1000);
    expect(restorePendingPix(1001)).toEqual(pix);
    expect(sessionStorage.getItem(PENDING_PIX_KEY)).not.toContain("cpf");
  });
  it("expires after 24 hours and removes the stale capability", () => {
    const now = 1_700_000_000_000;
    savePendingPix(pix, now);
    expect(restorePendingPix(now + 24 * 60 * 60 * 1000)).toBeNull();
    expect(sessionStorage.getItem(PENDING_PIX_KEY)).toBeNull();
  });
  it("rejects corrupt values and excess-size QR codes", () => {
    savePendingPix(pix, 1000);
    const data = JSON.parse(sessionStorage.getItem(PENDING_PIX_KEY)!);
    sessionStorage.setItem(
      PENDING_PIX_KEY,
      JSON.stringify({ ...data, qrcode: "x".repeat(200_000) }),
    );
    expect(restorePendingPix(1001)).toBeNull();
    sessionStorage.setItem(PENDING_PIX_KEY, "{bad");
    expect(restorePendingPix()).toBeNull();
  });
  it("clears the pending QR on confirmation or after an explicit restart", () => {
    savePendingPix(pix);
    clearPendingPix();
    expect(restorePendingPix()).toBeNull();
  });
});

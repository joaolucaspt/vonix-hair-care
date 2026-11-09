import { describe, expect, it } from "vitest";
import { paidEventTimestamp } from "@/lib/paid-event-time";

const now = Math.floor(Date.parse("2026-11-09T19:00:00.000Z") / 1000);

describe("paid Purchase attribution is time-bound to the merchant receipt", () => {
  it("accepts UTC and explicit timezone offset, preserving the same instant", () => {
    expect(paidEventTimestamp("2026-11-09T17:30:00.000Z", now))
      .toBe(Math.floor(Date.parse("2026-11-09T17:30:00.000Z") / 1000));
    expect(paidEventTimestamp("2026-11-09T14:30:00-03:00", now))
      .toBe(paidEventTimestamp("2026-11-09T17:30:00Z", now));
  });
  it("never invents a timestamp for missing or timezone-ambiguous dates", () => {
    for (const input of [undefined, null, "", 0, "2026-11-09", "2026-11-09T12:30:00",
      "2026-11-09 12:30:00", "2026-11-09T15:40:00-25:00", "bad"]) {
      expect(paidEventTimestamp(input, now)).toBeNull();
    }
  });
  it("denies historical (>6 day), far-future, and invalid merchant instants", () => {
    expect(paidEventTimestamp(new Date((now - 6 * 86400 - 1) * 1000).toISOString(), now))
      .toBeNull();
    expect(paidEventTimestamp(new Date((now + 61) * 1000).toISOString(), now))
      .toBeNull();
    expect(paidEventTimestamp("2026-02-30T12:30:00Z", now)).toBeNull();
    expect(paidEventTimestamp("2026-11-09T25:30:00Z", now)).toBeNull();
  });
  it("accepts the exact permitted boundaries", () => {
    expect(paidEventTimestamp(new Date((now - 6 * 86400) * 1000).toISOString(), now))
      .toBe(now - 6 * 86400);
    expect(paidEventTimestamp(new Date((now + 60) * 1000).toISOString(), now))
      .toBe(now + 60);
  });
});

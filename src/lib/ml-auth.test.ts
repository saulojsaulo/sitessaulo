import { describe, expect, it } from "vitest";
import { ML_MAX_PRODUCTS, ctr, remainingSlots } from "./ml-auth";

describe("afiliados ML", () => {
  it("limita a 50 produtos por site", () => {
    expect(ML_MAX_PRODUCTS).toBe(50);
    expect(remainingSlots(48)).toBe(2);
    expect(remainingSlots(50)).toBe(0);
    expect(remainingSlots(60)).toBe(0);
  });
  it("calcula CTR em %", () => {
    expect(ctr(200, 5)).toBe(2.5);
    expect(ctr(0, 3)).toBe(0);
  });
});


import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  registerSchema,
} from "@/lib/validations/auth";

const reg = (password: string, email = "nimal@example.com") =>
  registerSchema.safeParse({
    name: "Nimal",
    email,
    password,
  });

describe("password rules", () => {
  it("accepts a strong password", () => {
    expect(reg("Correct-Horse-42").success).toBe(true);
  });

  it.each<[string, string]>([
    ["too short", "Ab1defgh"],
    ["no uppercase", "correct-horse-42"],
    ["no lowercase", "CORRECT-HORSE-42"],
    ["no digit", "Correct-Horse-Battery"],
    ["too common", "Password123"],
    ["over 72 bytes", `Aa1${"é".repeat(40)}`],
    ["contains the email name", "Nimal-Rocks-2031"],
  ])(
    "rejects a password that is %s",
    (_why: string, password: string) => {
      expect(reg(password).success).toBe(false);
    },
  );

  it("applies the same rules to password changes", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "x",
        newPassword: "weak",
      }).success,
    ).toBe(false);

    expect(
      changePasswordSchema.safeParse({
        currentPassword: "x",
        newPassword: "Correct-Horse-42",
      }).success,
    ).toBe(true);
  });
});

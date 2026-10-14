import { z } from "zod";

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234",
  "qwerty", "qwerty123", "qwertyuiop", "letmein", "letmein123", "welcome",
  "welcome1", "welcome123", "admin123", "admin1234", "administrator",
  "iloveyou", "abc123456", "1234567890", "123456789", "changeme", "changeme123",
]);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .refine((s) => new TextEncoder().encode(s).length <= 72, "Password is too long (72 bytes maximum)")
  .refine(
    (s) => /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s),
    "Include an uppercase letter, a lowercase letter and a number",
  )
  .refine((s) => !COMMON_PASSWORDS.has(s.toLowerCase()), "This password is too common");

export const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    password: passwordSchema,
  })
  .superRefine((v, ctx) => {
    const local = v.email.split("@")[0];
    if (local.length >= 4 && v.password.toLowerCase().includes(local)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Password must not contain your email name" });
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});
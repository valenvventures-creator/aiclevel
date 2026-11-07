import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128)
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const signupSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required.").max(60),
    last_name: z.string().trim().min(1, "Last name is required.").max(60),
    email: z.string().trim().toLowerCase().email("Enter a valid email."),
    password: passwordSchema,
    confirm_password: z.string(),
    accept_terms: z.literal("on", { message: "You must accept the Terms of Service." }),
    accept_privacy: z.literal("on", { message: "You must acknowledge the Privacy Policy." }),
    invite_token: z.string().optional(),
  })
  .refine((d) => d.password === d.confirm_password, { path: ["confirm_password"], message: "Passwords do not match." });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
  remember: z.string().optional(),
  next: z.string().optional(),
});

export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email.") });

export const resetSchema = z
  .object({ token: z.string().min(10), password: passwordSchema, confirm_password: z.string() })
  .refine((d) => d.password === d.confirm_password, { path: ["confirm_password"], message: "Passwords do not match." });

/** Only allow same-origin relative redirects. */
export function safeNext(next: string | undefined | null, fallback = "/hq"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

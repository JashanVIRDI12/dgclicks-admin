import { z } from "zod";

/**
 * Shared by the forms and the server actions.
 *
 * One schema, two consumers: React Hook Form uses it for immediate feedback,
 * and the action re-parses against the same rules. The client copy is a
 * convenience — the server copy is the one that decides.
 */

const email = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .pipe(z.email("Enter a valid email address."))
  .transform((value) => value.toLowerCase());

/**
 * Minimum matches `emailAndPassword.minPasswordLength` in the auth config. If
 * one changes, change both — Better Auth enforces its own limit server-side and
 * a mismatch shows up as an unmapped error instead of a field message.
 */
const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(80, "Name must be at most 80 characters."),
  email,
  password,
});

export const requestPasswordResetSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "The reset link is invalid.").max(256),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Choose a password different from your current one.",
    path: ["newPassword"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

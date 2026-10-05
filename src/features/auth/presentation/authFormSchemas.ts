import { z } from 'zod';
import { PROFILE_DISPLAY_NAME_MAX_LENGTH } from '../domain/ProfileRepository';

const email = z.string().trim().email('Enter a valid email address.');
const password = z.string().min(1, 'Enter your password.');
export const signInSchema = z.object({ email, password });
export const passwordResetSchema = z.object({ email });
export const registrationSchema = z
  .object({
    email,
    password,
    displayName: z
      .string()
      .trim()
      .min(1, 'Enter your name.')
      .max(PROFILE_DISPLAY_NAME_MAX_LENGTH, 'Use a name of up to 100 characters.'),
    confirmation: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmation, {
    path: ['confirmation'],
    message: 'Passwords must match.',
  });
export type SignInValues = z.infer<typeof signInSchema>;
export type PasswordResetValues = z.infer<typeof passwordResetSchema>;
export type RegistrationValues = z.infer<typeof registrationSchema>;

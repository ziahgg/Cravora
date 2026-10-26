/** Input schemas shared by forms (client) and server actions (server). The database is the final check. */
import { z } from 'zod';

// Catalog ids are deterministic (md5-based) in the seed, so accept any 8-4-4-4-12 id.
export const id = z.guid({ message: 'Invalid id' });

export const emailSchema = z.email({ message: 'Enter a valid email address' }).trim().toLowerCase();
export const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer');
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number');

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(60),
  phone: phoneSchema,
  email: emailSchema,
  password: passwordSchema,
});
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password') });
export const forgotSchema = z.object({ email: emailSchema });
export const newPasswordSchema = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, { message: 'Passwords don’t match', path: ['confirm'] });

export const addToCartSchema = z.object({
  foodItemId: id,
  quantity: z.number().int().min(1, 'At least 1').max(20, 'At most 20'),
  optionValueIds: z.array(id).max(20),
  replace: z.boolean(),
});

export const quantitySchema = z.object({ cartItemId: id, quantity: z.number().int().min(0).max(20) });
export const promoSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, 'Codes are 3–20 letters or numbers')
    .nullable(),
});

export const addressSchema = z.object({
  id: id.nullable(),
  label: z.enum(['home', 'work', 'other']),
  recipientName: z.string().trim().min(1, 'Name is required').max(60),
  phone: phoneSchema,
  addressLine: z.string().trim().min(3, 'Street address is required').max(120),
  unit: z.string().trim().max(40),
  city: z.string().trim().min(2, 'City is required').max(60),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{3,10}$/, 'Enter a valid ZIP / postal code'),
  deliveryInstructions: z.string().trim().max(200),
  isDefault: z.boolean(),
});

export const checkoutSchema = z
  .object({
    addressId: id,
    paymentMethod: z.enum(['cash_on_delivery', 'demo_card']),
    idempotencyKey: z.guid(),
    scheduledFor: z.iso.datetime({ offset: true }).nullable(),
    instructions: z.string().trim().max(200).nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.scheduledFor) return;
    const t = Date.parse(v.scheduledFor);
    const now = Date.now();
    if (t < now + 30 * 60_000 || t > now + 7 * 86_400_000) ctx.addIssue({ code: 'custom', path: ['scheduledFor'], message: 'Pick a time between 30 minutes and 7 days from now' });
  });

export const reviewSchema = z.object({ orderId: id, rating: z.number().int().min(1, 'Pick a rating').max(5), comment: z.string().trim().max(500) });

export const profileSchema = z.object({ displayName: z.string().trim().min(1, 'Name is required').max(60), phone: phoneSchema.nullable() });

export const searchSchema = z.object({ q: z.string().trim().max(60) });

export type FieldErrors = Record<string, string>;
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of error.issues) out[i.path.length ? i.path.join('.') : 'form'] ??= i.message;
  return out;
}

import { z } from 'zod';

export const idSchema = z.string().uuid();
export const usernameSchema = z.string().regex(/^[A-Za-z0-9_]{4,20}$/);
export const passwordSchema = z.string().min(10).max(128);
export const displayNameSchema = z.string().trim().min(2).max(30);

export const signupSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128),
});
export const profileSchema = z.object({ bio: z.string().trim().max(500) });
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export const productSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(3000),
  price: z.coerce.number().int().min(1).max(1_000_000_000),
  status: z.enum(['ACTIVE', 'RESERVED', 'SOLD']).optional(),
});
export const productQuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'RESERVED', 'SOLD']).default('ACTIVE'),
  sort: z.enum(['newest', 'priceAsc', 'priceDesc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export const messageSchema = z.object({
  content: z.string().trim().min(1).max(500),
  clientMessageId: idSchema.optional(),
});
export const directRoomSchema = z.object({ userId: idSchema });
export const userSearchSchema = z.object({
  q: z.string().trim().min(1).max(30),
});
export const reportSchema = z
  .object({
    targetType: z.enum(['USER', 'PRODUCT']),
    targetUserId: idSchema.optional(),
    targetProductId: idSchema.optional(),
    reason: z.string().trim().min(10).max(1000),
  })
  .superRefine((value, ctx) => {
    const valid =
      value.targetType === 'USER'
        ? !!value.targetUserId && !value.targetProductId
        : !!value.targetProductId && !value.targetUserId;
    if (!valid)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '신고 대상이 올바르지 않습니다.' });
  });
export const transferSchema = z.object({
  receiverId: idSchema,
  amount: z.number().int().min(1).max(1_000_000_000),
  idempotencyKey: z.string().uuid(),
});
export const adminStatusSchema = z.object({ status: z.enum(['ACTIVE', 'DORMANT', 'BANNED']) });
export const adminProductStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'RESERVED', 'SOLD', 'HIDDEN', 'DELETED']),
});
export const reviewReportSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  restoreTarget: z.boolean().default(false),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type TransferInput = z.infer<typeof transferSchema>;

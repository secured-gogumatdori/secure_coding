import { Router } from 'express';
import {
  adminProductStatusSchema,
  adminStatusSchema,
  idSchema,
  reviewReportSchema,
} from '@tiny/shared';
import { prisma } from './db.js';
import { asyncHandler, HttpError, jsonBigInt, parse, requireAdmin } from './http.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

async function audit(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  beforeData: unknown,
  afterData: unknown,
) {
  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action,
      targetType,
      targetId,
      beforeData: jsonBigInt(beforeData) ?? undefined,
      afterData: jsonBigInt(afterData) ?? undefined,
    },
  });
}

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [users, products, activeProducts, pendingReports, transfers] = await prisma.$transaction([
      prisma.user.count(),
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.transfer.count(),
    ]);
    res.json({ users, products, activeProducts, pendingReports, transfers });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ users });
  }),
);

adminRouter.patch(
  '/users/:id/status',
  asyncHandler(async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const { status } = parse(adminStatusSchema, req.body);
    const before = await prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true, role: true },
    });
    if (!before) throw new HttpError(404, 'USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    if (before.role === 'ADMIN' && id === req.session.userId && status !== 'ACTIVE')
      throw new HttpError(
        400,
        'SELF_ADMIN_LOCK_DENIED',
        '현재 관리자 계정을 비활성화할 수 없습니다.',
      );
    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, username: true, displayName: true, status: true },
    });
    await audit(req.session.userId!, 'USER_STATUS_CHANGE', 'USER', id, before, user);
    res.json({ user });
  }),
);

adminRouter.get(
  '/products',
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      include: { seller: { select: { id: true, username: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(jsonBigInt({ products }));
  }),
);

adminRouter.patch(
  '/products/:id/status',
  asyncHandler(async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const { status } = parse(adminProductStatusSchema, req.body);
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, 'PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다.');
    const product = await prisma.product.update({
      where: { id },
      data: {
        status,
        deletedAt: status === 'DELETED' ? new Date() : status === 'ACTIVE' ? null : undefined,
      },
    });
    await audit(req.session.userId!, 'PRODUCT_STATUS_CHANGE', 'PRODUCT', id, before, product);
    res.json(jsonBigInt({ product }));
  }),
);

adminRouter.get(
  '/reports',
  asyncHandler(async (_req, res) => {
    const reports = await prisma.report.findMany({
      include: {
        reporter: { select: { username: true, displayName: true } },
        targetUser: { select: { username: true, displayName: true, status: true } },
        targetProduct: { select: { name: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ reports });
  }),
);

adminRouter.patch(
  '/reports/:id/review',
  asyncHandler(async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const input = parse(reviewReportSchema, req.body);
    const before = await prisma.report.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, 'REPORT_NOT_FOUND', '신고를 찾을 수 없습니다.');
    if (before.status !== 'PENDING')
      throw new HttpError(409, 'REPORT_ALREADY_REVIEWED', '이미 검토한 신고입니다.');
    const report = await prisma.$transaction(async (tx) => {
      const updated = await tx.report.update({
        where: { id },
        data: {
          status: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewedBy: req.session.userId,
          reviewedAt: new Date(),
        },
      });
      if (input.restoreTarget && input.decision === 'REJECT') {
        if (updated.targetProductId)
          await tx.product.update({
            where: { id: updated.targetProductId },
            data: { status: 'ACTIVE' },
          });
        if (updated.targetUserId)
          await tx.user.update({ where: { id: updated.targetUserId }, data: { status: 'ACTIVE' } });
      }
      return updated;
    });
    await audit(req.session.userId!, 'REPORT_REVIEW', 'REPORT', id, before, report);
    res.json({ report });
  }),
);

adminRouter.get(
  '/messages',
  asyncHandler(async (_req, res) => {
    const messages = await prisma.message.findMany({
      include: {
        sender: { select: { username: true, displayName: true } },
        chatRoom: { select: { type: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ messages });
  }),
);

adminRouter.patch(
  '/messages/:id/hide',
  asyncHandler(async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const before = await prisma.message.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, 'MESSAGE_NOT_FOUND', '메시지를 찾을 수 없습니다.');
    const message = await prisma.message.update({
      where: { id },
      data: { status: 'HIDDEN', hiddenAt: new Date() },
    });
    await audit(req.session.userId!, 'MESSAGE_HIDE', 'MESSAGE', id, before, message);
    res.json({ message });
  }),
);

adminRouter.get(
  '/transfers',
  asyncHandler(async (_req, res) => {
    const transfers = await prisma.transfer.findMany({
      include: {
        sender: { select: { username: true, displayName: true } },
        receiver: { select: { username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(jsonBigInt({ transfers }));
  }),
);

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (_req, res) => {
    const logs = await prisma.adminAuditLog.findMany({
      include: { admin: { select: { username: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ logs });
  }),
);

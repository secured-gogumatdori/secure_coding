import { Router } from 'express';
import { reportSchema } from '@tiny/shared';
import { config } from './config.js';
import { prisma } from './db.js';
import { asyncHandler, HttpError, parse, requireAuth } from './http.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = parse(reportSchema, req.body);
    const reporterId = req.session.userId!;
    if (input.targetType === 'USER') {
      if (input.targetUserId === reporterId)
        throw new HttpError(400, 'SELF_REPORT_DENIED', '본인을 신고할 수 없습니다.');
      const target = await prisma.user.findUnique({ where: { id: input.targetUserId } });
      if (!target) throw new HttpError(404, 'TARGET_NOT_FOUND', '신고 대상을 찾을 수 없습니다.');
    } else {
      const product = await prisma.product.findUnique({ where: { id: input.targetProductId } });
      if (!product || product.status === 'DELETED')
        throw new HttpError(404, 'TARGET_NOT_FOUND', '신고 대상을 찾을 수 없습니다.');
      if (product.sellerId === reporterId)
        throw new HttpError(400, 'SELF_REPORT_DENIED', '본인 상품을 신고할 수 없습니다.');
    }
    const report = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.report.findFirst({
        where: {
          reporterId,
          targetType: input.targetType,
          targetUserId: input.targetUserId,
          targetProductId: input.targetProductId,
        },
      });
      if (duplicate) throw new HttpError(409, 'REPORT_DUPLICATE', '이미 신고한 대상입니다.');
      const created = await tx.report.create({
        data: {
          reporterId,
          targetType: input.targetType,
          targetUserId: input.targetUserId,
          targetProductId: input.targetProductId,
          reason: input.reason,
        },
      });
      const count = await tx.report.count({
        where: {
          targetType: input.targetType,
          targetUserId: input.targetUserId,
          targetProductId: input.targetProductId,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });
      if (input.targetType === 'PRODUCT' && count >= config.PRODUCT_REPORT_THRESHOLD)
        await tx.product.update({
          where: { id: input.targetProductId! },
          data: { status: 'HIDDEN' },
        });
      if (input.targetType === 'USER' && count >= config.USER_REPORT_THRESHOLD)
        await tx.user.update({ where: { id: input.targetUserId! }, data: { status: 'DORMANT' } });
      return created;
    });
    req.log?.warn(
      { event: 'report_created', reporterId, reportId: report.id, targetType: report.targetType },
      'security event',
    );
    res.status(201).json({ report });
  }),
);

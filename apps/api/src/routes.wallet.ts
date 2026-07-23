import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { transferSchema } from '@tiny/shared';
import { prisma } from './db.js';
import { asyncHandler, HttpError, jsonBigInt, parse, requireAuth } from './http.js';

export const walletRouter = Router();
walletRouter.use(requireAuth);

walletRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: req.session.userId } });
    res.json(jsonBigInt({ wallet }));
  }),
);

walletRouter.get(
  '/transfers',
  asyncHandler(async (req, res) => {
    const transfers = await prisma.transfer.findMany({
      where: { OR: [{ senderId: req.session.userId }, { receiverId: req.session.userId }] },
      include: {
        sender: { select: { id: true, username: true, displayName: true } },
        receiver: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(jsonBigInt({ transfers }));
  }),
);

walletRouter.post(
  '/transfers',
  asyncHandler(async (req, res) => {
    const input = parse(transferSchema, req.body);
    const senderId = req.session.userId!;
    if (input.receiverId === senderId)
      throw new HttpError(400, 'SELF_TRANSFER_DENIED', '본인에게 송금할 수 없습니다.');
    const existing = await prisma.transfer.findUnique({
      where: { senderId_idempotencyKey: { senderId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) return res.json(jsonBigInt({ transfer: existing, duplicate: true }));
    const receiver = await prisma.user.findUnique({
      where: { id: input.receiverId },
      select: { status: true },
    });
    if (receiver?.status !== 'ACTIVE')
      throw new HttpError(400, 'RECEIVER_UNAVAILABLE', '송금할 수 없는 사용자입니다.');
    const amount = BigInt(input.amount);
    try {
      const transfer = await prisma.$transaction(
        async (tx) => {
          const debit = await tx.wallet.updateMany({
            where: { userId: senderId, balance: { gte: amount } },
            data: { balance: { decrement: amount } },
          });
          if (debit.count !== 1)
            throw new HttpError(409, 'INSUFFICIENT_BALANCE', '잔액이 부족합니다.');
          const senderWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: senderId } });
          const receiverWallet = await tx.wallet.update({
            where: { userId: input.receiverId },
            data: { balance: { increment: amount } },
          });
          const created = await tx.transfer.create({
            data: {
              senderId,
              receiverId: input.receiverId,
              amount,
              idempotencyKey: input.idempotencyKey,
            },
          });
          await tx.walletEntry.createMany({
            data: [
              {
                walletId: senderWallet.id,
                transferId: created.id,
                entryType: 'DEBIT',
                amount,
                balanceAfter: senderWallet.balance,
              },
              {
                walletId: receiverWallet.id,
                transferId: created.id,
                entryType: 'CREDIT',
                amount,
                balanceAfter: receiverWallet.balance,
              },
            ],
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      res.status(201).json(jsonBigInt({ transfer, duplicate: false }));
    } catch (error) {
      const known = error as { code?: string };
      if (known.code === 'P2002') {
        const transfer = await prisma.transfer.findUnique({
          where: { senderId_idempotencyKey: { senderId, idempotencyKey: input.idempotencyKey } },
        });
        if (transfer) return res.json(jsonBigInt({ transfer, duplicate: true }));
      }
      if (known.code === 'P2034')
        throw new HttpError(
          409,
          'TRANSFER_CONFLICT',
          '동시 요청이 감지되었습니다. 같은 송금 내용으로 다시 시도해 주세요.',
        );
      throw error;
    }
  }),
);

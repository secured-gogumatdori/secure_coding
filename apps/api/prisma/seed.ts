import 'dotenv/config';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const prisma = new PrismaClient();
const adminPassword = process.env.ADMIN_PASSWORD;
const userPassword = process.env.SEED_USER_PASSWORD;
if (!adminPassword || adminPassword.length < 10 || !userPassword || userPassword.length < 10)
  throw new Error('ADMIN_PASSWORD와 SEED_USER_PASSWORD를 각각 10자 이상으로 설정하세요.');
const options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 3, parallelism: 1 } as const;

async function main() {
  const [adminHash, userHash] = await Promise.all([
    argon2.hash(adminPassword, options),
    argon2.hash(userPassword, options),
  ]);
  const specs = [
    {
      username: process.env.ADMIN_USERNAME ?? 'admin_user',
      displayName: process.env.ADMIN_DISPLAY_NAME ?? '관리자',
      role: 'ADMIN' as const,
      passwordHash: adminHash,
    },
    { username: 'demo_mina', displayName: '미나', role: 'USER' as const, passwordHash: userHash },
    { username: 'demo_jun', displayName: '준', role: 'USER' as const, passwordHash: userHash },
    { username: 'demo_sora', displayName: '소라', role: 'USER' as const, passwordHash: userHash },
  ];
  const users = [];
  for (const spec of specs)
    users.push(
      await prisma.user.upsert({
        where: { username: spec.username },
        update: { displayName: spec.displayName, role: spec.role },
        create: {
          ...spec,
          wallet: { create: { balance: BigInt(process.env.DEMO_INITIAL_BALANCE ?? 100000) } },
        },
      }),
    );
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? 'apps/api/uploads');
  // The directory is an operator-controlled environment setting, never a request value.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await mkdir(uploadDir, { recursive: true });
  const colors = ['#2b7a55', '#d48a32', '#5477b8', '#9d596f', '#5e856d'];
  for (let i = 0; i < 5; i++)
    await sharp({ create: { width: 800, height: 600, channels: 3, background: colors[i]! } })
      .webp()
      .toFile(path.join(uploadDir, `seed-product-${i + 1}.webp`));
  if ((await prisma.product.count()) === 0) {
    const names = ['기계식 키보드', '캠핑 의자', '필름 카메라', '원목 스툴', '러닝 재킷'];
    for (let i = 0; i < names.length; i++)
      await prisma.product.create({
        data: {
          sellerId: users[(i % 3) + 1]!.id,
          name: names[i]!,
          description: `깨끗하게 사용한 ${names[i]}입니다. 직거래를 선호합니다.`,
          price: BigInt((i + 1) * 15000),
          imagePath: `seed-product-${i + 1}.webp`,
        },
      });
  }
  let global = await prisma.chatRoom.findFirst({ where: { type: 'GLOBAL' } });
  global ??= await prisma.chatRoom.create({ data: { type: 'GLOBAL' } });
  if ((await prisma.message.count({ where: { chatRoomId: global.id } })) === 0)
    await prisma.message.create({
      data: {
        chatRoomId: global.id,
        senderId: users[1]!.id,
        content: 'Tiny Market 전체 채팅에 오신 것을 환영합니다!',
      },
    });
  const ids = [users[1]!.id, users[2]!.id].sort();
  const directKey = `${ids[0]}:${ids[1]}`;
  const direct = await prisma.chatRoom.upsert({
    where: { directKey },
    update: {},
    create: { type: 'DIRECT', directKey, members: { create: ids.map((userId) => ({ userId })) } },
  });
  if ((await prisma.message.count({ where: { chatRoomId: direct.id } })) === 0)
    await prisma.message.create({
      data: { chatRoomId: direct.id, senderId: users[1]!.id, content: '상품 상태가 어떤가요?' },
    });
  const sampleProduct = await prisma.product.findFirst({ where: { sellerId: users[1]!.id } });
  if (
    sampleProduct &&
    !(await prisma.report.findFirst({
      where: { reporterId: users[2]!.id, targetProductId: sampleProduct.id },
    }))
  )
    await prisma.report.create({
      data: {
        reporterId: users[2]!.id,
        targetType: 'PRODUCT',
        targetProductId: sampleProduct.id,
        reason: '설명과 사진이 달라 확인이 필요합니다.',
      },
    });
  const key = '00000000-0000-4000-8000-000000000001';
  if (
    !(await prisma.transfer.findUnique({
      where: { senderId_idempotencyKey: { senderId: users[2]!.id, idempotencyKey: key } },
    }))
  )
    await prisma.$transaction(async (tx) => {
      const amount = 5000n;
      const from = await tx.wallet.update({
        where: { userId: users[2]!.id },
        data: { balance: { decrement: amount } },
      });
      const to = await tx.wallet.update({
        where: { userId: users[1]!.id },
        data: { balance: { increment: amount } },
      });
      const transfer = await tx.transfer.create({
        data: { senderId: users[2]!.id, receiverId: users[1]!.id, amount, idempotencyKey: key },
      });
      await tx.walletEntry.createMany({
        data: [
          {
            walletId: from.id,
            transferId: transfer.id,
            entryType: 'DEBIT',
            amount,
            balanceAfter: from.balance,
          },
          {
            walletId: to.id,
            transferId: transfer.id,
            entryType: 'CREDIT',
            amount,
            balanceAfter: to.balance,
          },
        ],
      });
    });
  console.log(
    `Seed 완료: 관리자 ${specs[0]!.username}, 일반 사용자 ${specs
      .slice(1)
      .map((v) => v.username)
      .join(', ')}`,
  );
}
main().finally(() => prisma.$disconnect());

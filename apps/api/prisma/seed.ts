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

const productSeeds = [
  {
    name: '로지텍 MX Keys Mini 미니 키보드',
    description:
      '재택근무용으로 1년 정도 사용했습니다. 모든 키와 블루투스 연결 정상이고, 눈에 띄는 찍힘은 없습니다. 키보드와 USB-C 충전 케이블 함께 드립니다. 합정역 인근 직거래 또는 반값택배 가능합니다.',
    price: 73000,
    imagePath: 'seed-product-1.webp',
    colors: ['#dce8df', '#789388'],
    artwork: `
      <g transform="translate(155 175) rotate(-4 245 125)" filter="url(#shadow)">
        <rect width="490" height="250" rx="24" fill="#313936"/>
        <rect x="20" y="22" width="450" height="206" rx="14" fill="#454e4a"/>
        ${Array.from({ length: 5 }, (_, row) =>
          Array.from(
            { length: row === 4 ? 8 : 12 },
            (_, col) =>
              `<rect x="${34 + col * (row === 4 ? 51 : 35)}" y="${36 + row * 38}" width="${row === 4 ? 43 : 27}" height="28" rx="5" fill="#d9dedb"/>`,
          ).join(''),
        ).join('')}
      </g>`,
  },
  {
    name: '코베아 릴렉스 캠핑 체어 2개 세트',
    description:
      '지난가을 두 번 사용한 캠핑 의자입니다. 베이지 색상 2개 한 세트이며 전용 수납가방도 있습니다. 프레임 휘어짐이나 원단 찢어짐 없이 깨끗하고, 바닥 닿는 부분에만 가벼운 사용감이 있습니다.',
    price: 45000,
    imagePath: 'seed-product-2.webp',
    colors: ['#f0e2c7', '#b4814f'],
    artwork: `
      <g transform="translate(190 85)" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)">
        <path d="M95 105 L270 145 L240 370 L55 330 Z" fill="#c59a64" stroke="#765438" stroke-width="14"/>
        <path d="M82 103 L30 420 M274 145 L330 420 M58 330 L300 330" fill="none" stroke="#3f4742" stroke-width="18"/>
        <path d="M62 200 L20 260 M255 225 L335 275" fill="none" stroke="#3f4742" stroke-width="16"/>
        <path d="M79 116 L254 155" stroke="#ead6ae" stroke-width="5" opacity=".8"/>
      </g>`,
  },
  {
    name: '올림푸스 뮤 줌 필름카메라',
    description:
      '최근 필름 한 롤 테스트했고 플래시, 줌, 날짜 표시 모두 정상 작동합니다. 렌즈에 곰팡이나 스크래치 없으며 생활기스는 사진처럼 조금 있습니다. 스트랩과 새 CR123A 배터리 포함입니다.',
    price: 128000,
    imagePath: 'seed-product-3.webp',
    colors: ['#d9e4ee', '#718ba5'],
    artwork: `
      <g transform="translate(135 150) rotate(3 265 145)" filter="url(#shadow)">
        <rect width="530" height="290" rx="68" fill="#c9cdce" stroke="#4b5356" stroke-width="13"/>
        <path d="M18 105 Q120 40 250 62 L250 270 L65 270 Q18 245 18 190 Z" fill="#aeb4b6"/>
        <circle cx="320" cy="153" r="104" fill="#40494c" stroke="#eef0ed" stroke-width="13"/>
        <circle cx="320" cy="153" r="69" fill="#18252b" stroke="#68787d" stroke-width="16"/>
        <circle cx="320" cy="153" r="33" fill="#34586a"/>
        <circle cx="305" cy="136" r="11" fill="#b9e4f0" opacity=".8"/>
        <rect x="70" y="76" width="92" height="48" rx="10" fill="#465154"/>
        <rect x="427" y="78" width="64" height="38" rx="8" fill="#ecdfc1"/>
      </g>`,
  },
  {
    name: '오크 원목 사이드 스툴',
    description:
      '침대 옆 협탁으로 사용한 오크 원목 스툴입니다. 가로 38cm, 세로 28cm, 높이 44cm입니다. 흔들림 없고 상판 모서리에 작은 생활흔적 하나 외에는 상태 좋습니다. 부피 때문에 망원동 직거래만 가능합니다.',
    price: 39000,
    imagePath: 'seed-product-4.webp',
    colors: ['#eadbc4', '#ad7a4e'],
    artwork: `
      <g transform="translate(165 85)" stroke="#755038" stroke-linejoin="round" filter="url(#shadow)">
        <path d="M55 95 L390 70 L445 160 L105 192 Z" fill="#bd8755" stroke-width="12"/>
        <path d="M105 192 L445 160 L422 208 L126 238 Z" fill="#9a673f" stroke-width="10"/>
        <path d="M132 227 L190 221 L168 470 L116 470 Z M372 205 L423 195 L445 455 L395 458 Z" fill="#a87549" stroke-width="12"/>
        <path d="M85 122 Q220 85 407 102 M119 155 Q270 118 428 133" fill="none" stroke="#d7aa76" stroke-width="6" opacity=".8"/>
      </g>`,
  },
  {
    name: '나이키 드라이핏 러닝 재킷 M',
    description:
      '봄가을 저녁 러닝 때 입기 좋은 얇은 바람막이입니다. 남녀공용 M 사이즈이며 실착은 5회 미만입니다. 세탁 완료했고 오염이나 보풀 없습니다. 양쪽 지퍼 포켓과 등판 통풍 디테일이 있습니다.',
    price: 32000,
    imagePath: 'seed-product-5.webp',
    colors: ['#e2dedb', '#8f7770'],
    artwork: `
      <g transform="translate(170 48)" stroke="#414947" stroke-linejoin="round" filter="url(#shadow)">
        <path d="M145 70 L225 45 L305 72 L420 165 L360 255 L322 225 L345 500 L105 500 L128 225 L88 258 L28 168 Z" fill="#59645f" stroke-width="13"/>
        <path d="M145 70 Q175 150 225 155 Q275 150 305 72" fill="#39423f" stroke-width="10"/>
        <path d="M225 153 L225 500 M130 255 L193 285 M320 255 L257 285" fill="none" stroke="#dbe2de" stroke-width="8"/>
        <path d="M342 342 Q305 322 280 348 Q315 360 342 342 Z" fill="#e8ece9" stroke="none"/>
      </g>`,
  },
] as const;

function productImage(seed: (typeof productSeeds)[number]) {
  const [light, dark] = seed.colors;
  return Buffer.from(`
    <svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${light}"/>
          <stop offset="1" stop-color="${dark}"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="18" stdDeviation="14" flood-color="#26342e" flood-opacity=".25"/>
        </filter>
      </defs>
      <rect width="800" height="600" fill="url(#background)"/>
      <circle cx="690" cy="80" r="170" fill="#fff" opacity=".13"/>
      <circle cx="90" cy="545" r="130" fill="#fff" opacity=".1"/>
      <ellipse cx="400" cy="535" rx="265" ry="30" fill="#26342e" opacity=".12"/>
      ${seed.artwork}
    </svg>`);
}

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
  for (const [index, seed] of productSeeds.entries()) {
    await sharp(productImage(seed))
      .webp({ quality: 88 })
      .toFile(path.join(uploadDir, seed.imagePath));
    const existing = await prisma.product.findFirst({ where: { imagePath: seed.imagePath } });
    if (existing)
      await prisma.product.update({
        where: { id: existing.id },
        data: { name: seed.name, description: seed.description, price: BigInt(seed.price) },
      });
    else
      await prisma.product.create({
        data: {
          sellerId: users[(index % 3) + 1]!.id,
          name: seed.name,
          description: seed.description,
          price: BigInt(seed.price),
          imagePath: seed.imagePath,
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

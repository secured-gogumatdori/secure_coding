import request from 'supertest';
import sharp from 'sharp';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { pgPool, prisma } from '../src/db.js';
import { removeImage } from '../src/upload.js';

const suffix = Date.now().toString().slice(-8);
const password = `Aa!9-${crypto.randomUUID()}`;
const image = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#339966' } })
  .png()
  .toBuffer();

async function csrf(agent: request.Agent) {
  return (await agent.get('/api/auth/csrf')).body.csrfToken as string;
}
async function makeUser(name: string) {
  const agent = request.agent(app);
  let token = await csrf(agent);
  const username = `t_${name}_${suffix}`.slice(0, 20);
  await agent
    .post('/api/auth/signup')
    .set('x-csrf-token', token)
    .send({ username, password, displayName: `테스트${name}` })
    .expect(201);
  const login = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', token)
    .send({ username, password })
    .expect(200);
  token = login.body.csrfToken;
  return { agent, token, user: login.body.user as { id: string; username: string } };
}

beforeAll(async () => {
  await prisma.$connect();
});
afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { username: { endsWith: suffix } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const images = await prisma.product.findMany({
      where: { sellerId: { in: ids } },
      select: { imagePath: true },
    });
    await prisma.adminAuditLog.deleteMany({ where: { adminId: { in: ids } } });
    await prisma.walletEntry.deleteMany({ where: { wallet: { userId: { in: ids } } } });
    await prisma.transfer.deleteMany({
      where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] },
    });
    await prisma.report.deleteMany({
      where: { OR: [{ reporterId: { in: ids } }, { targetUserId: { in: ids } }] },
    });
    await prisma.message.deleteMany({ where: { senderId: { in: ids } } });
    await prisma.chatMember.deleteMany({ where: { userId: { in: ids } } });
    await prisma.product.deleteMany({ where: { sellerId: { in: ids } } });
    await Promise.all(images.map(({ imagePath }) => removeImage(imagePath)));
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
  await pgPool.end();
});

describe('인증과 CSRF', () => {
  it('회원가입, 중복 차단, 약한 비밀번호 거부, 로그인 성공/실패', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const username = `t_auth_${suffix}`.slice(0, 20);
    await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', token)
      .send({ username, password, displayName: '인증사용자' })
      .expect(201);
    await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', token)
      .send({ username, password, displayName: '인증사용자' })
      .expect(409);
    await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', token)
      .send({
        username: `t_weak_${suffix}`.slice(0, 20),
        password: 'short',
        displayName: '약한사용자',
      })
      .expect(400);
    await agent
      .post('/api/auth/login')
      .set('x-csrf-token', token)
      .send({ username, password: 'wrong' })
      .expect(401);
    await agent
      .post('/api/auth/login')
      .set('x-csrf-token', token)
      .send({ username, password })
      .expect(200);
  });
  it('CSRF 토큰과 인증 없는 상태 변경을 차단한다', async () => {
    const agent = request.agent(app);
    await csrf(agent);
    await agent
      .post('/api/auth/signup')
      .send({ username: `t_csrf_${suffix}`.slice(0, 20), password, displayName: '씨에스알에프' })
      .expect(403);
    await request(app).post('/api/products').expect(403);
  });
  it('검증·JSON 파서의 내부 상세를 오류 응답에 노출하지 않는다', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const validation = await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', token)
      .send({ username: '!', password: 'short', displayName: '' })
      .expect(400);
    expect(validation.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: '입력값을 확인해 주세요.' },
    });
    expect(validation.body.error).not.toHaveProperty('details');

    const malformed = await request(app)
      .post('/api/auth/login')
      .set('content-type', 'application/json')
      .send('{"username":')
      .expect(400);
    expect(malformed.body).toMatchObject({
      error: { code: 'INVALID_JSON', message: '요청 본문 형식을 확인해 주세요.' },
    });
    expect(JSON.stringify(malformed.body)).not.toMatch(/SyntaxError|Unexpected token|stack/i);
  });
});

describe('상품, 검색, IDOR', () => {
  it('상품 CRUD, XSS 문자열의 일반 문자열 반환, SQLi 형태 검색을 처리한다', async () => {
    const owner = await makeUser('owner');
    const other = await makeUser('other');
    const created = await owner.agent
      .post('/api/products')
      .set('x-csrf-token', owner.token)
      .field('name', '<script>alert(1)</script>')
      .field('description', "' OR 1=1 --")
      .field('price', '12000')
      .attach('image', image, { filename: 'test.png', contentType: 'image/png' })
      .expect(201);
    const id = created.body.product.id;
    expect((await request(app).get(`/api/products/${id}`).expect(200)).body.product.name).toBe(
      '<script>alert(1)</script>',
    );
    await request(app).get('/api/products').query({ q: "' OR 1=1 --" }).expect(200);
    await other.agent
      .put(`/api/products/${id}`)
      .set('x-csrf-token', other.token)
      .field('name', '탈취 수정')
      .field('description', '내용')
      .field('price', '1')
      .expect(403);
    await other.agent.delete(`/api/products/${id}`).set('x-csrf-token', other.token).expect(403);
    await owner.agent
      .put(`/api/products/${id}`)
      .set('x-csrf-token', owner.token)
      .field('name', '안전한 상품')
      .field('description', '수정 완료')
      .field('price', '13000')
      .expect(200);
    await owner.agent.delete(`/api/products/${id}`).set('x-csrf-token', owner.token).expect(204);
  });
  it('MIME만 이미지인 잘못된 파일 시그니처를 거부한다', async () => {
    const owner = await makeUser('badimg');
    await owner.agent
      .post('/api/products')
      .set('x-csrf-token', owner.token)
      .field('name', '가짜 이미지 상품')
      .field('description', '잘못된 이미지 테스트')
      .field('price', '1000')
      .attach('image', Buffer.from('not-an-image'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
      .expect(400);
  });
  it('경로 조작 요청을 파일 내용이나 서버 경로 없이 거부한다', async () => {
    const response = await request(app).get('/uploads/%2e%2e%2fpackage.json').expect(404);
    expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(JSON.stringify(response.body)).not.toMatch(/package\.json|\/home\/|node_modules|stack/i);
  });
});

describe('신고, 채팅 권한, 관리자 RBAC', () => {
  it('사용자 검색 입력을 검증하고 비활성 사용자의 기존 세션을 거부한다', async () => {
    const member = await makeUser('search');
    const invalid = await member.agent.get('/api/users/search?q=').expect(400);
    expect(invalid.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: '입력값을 확인해 주세요.',
    });

    await prisma.user.update({ where: { id: member.user.id }, data: { status: 'DORMANT' } });
    await member.agent.get('/api/users/search?q=test').expect(403);
  });

  it('중복 신고를 막고 고유 신고자 임계치에서 상품을 숨긴다', async () => {
    const seller = await makeUser('seller');
    const reporters = await Promise.all([makeUser('rep1'), makeUser('rep2'), makeUser('rep3')]);
    const product = (
      await seller.agent
        .post('/api/products')
        .set('x-csrf-token', seller.token)
        .field('name', '신고 대상 상품')
        .field('description', '설명')
        .field('price', '5000')
        .attach('image', image, { filename: 'p.png', contentType: 'image/png' })
    ).body.product;
    for (const reporter of reporters)
      await reporter.agent
        .post('/api/reports')
        .set('x-csrf-token', reporter.token)
        .send({
          targetType: 'PRODUCT',
          targetProductId: product.id,
          reason: '검토가 필요한 신고 사유입니다.',
        })
        .expect(201);
    await reporters[0]!.agent
      .post('/api/reports')
      .set('x-csrf-token', reporters[0]!.token)
      .send({
        targetType: 'PRODUCT',
        targetProductId: product.id,
        reason: '다시 제출하는 신고 사유입니다.',
      })
      .expect(409);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe(
      'HIDDEN',
    );
  });
  it('1대1 방 비참여자와 일반 사용자의 관리자 API 접근을 차단한다', async () => {
    const a = await makeUser('chat1'),
      b = await makeUser('chat2'),
      outsider = await makeUser('out');
    const room = (
      await a.agent
        .post('/api/chats/direct')
        .set('x-csrf-token', a.token)
        .send({ userId: b.user.id })
        .expect(201)
    ).body.room;
    await a.agent
      .post(`/api/chats/${room.id}/messages`)
      .set('x-csrf-token', a.token)
      .send({ content: '안전한 메시지' })
      .expect(201);
    await outsider.agent.get(`/api/chats/${room.id}/messages`).expect(403);
    await a.agent.get('/api/admin/stats').expect(403);
  });
});

describe('데모 지갑 송금 무결성', () => {
  it('정상/초과/자기/중복 송금과 동시 송금을 검증한다', async () => {
    const sender = await makeUser('money'),
      r1 = await makeUser('recv1'),
      r2 = await makeUser('recv2');
    const key = crypto.randomUUID();
    const normal = await sender.agent
      .post('/api/wallet/transfers')
      .set('x-csrf-token', sender.token)
      .send({ receiverId: r1.user.id, amount: 1000, idempotencyKey: key })
      .expect(201);
    const duplicate = await sender.agent
      .post('/api/wallet/transfers')
      .set('x-csrf-token', sender.token)
      .send({ receiverId: r1.user.id, amount: 1000, idempotencyKey: key })
      .expect(200);
    expect(duplicate.body.transfer.id).toBe(normal.body.transfer.id);
    await sender.agent
      .post('/api/wallet/transfers')
      .set('x-csrf-token', sender.token)
      .send({ receiverId: sender.user.id, amount: 1, idempotencyKey: crypto.randomUUID() })
      .expect(400);
    await sender.agent
      .post('/api/wallet/transfers')
      .set('x-csrf-token', sender.token)
      .send({ receiverId: r1.user.id, amount: 999999999, idempotencyKey: crypto.randomUUID() })
      .expect(409);
    const concurrent = await Promise.all([
      r2.agent
        .post('/api/wallet/transfers')
        .set('x-csrf-token', r2.token)
        .send({ receiverId: r1.user.id, amount: 70000, idempotencyKey: crypto.randomUUID() }),
      r2.agent
        .post('/api/wallet/transfers')
        .set('x-csrf-token', r2.token)
        .send({ receiverId: sender.user.id, amount: 70000, idempotencyKey: crypto.randomUUID() }),
    ]);
    expect(concurrent.filter((v) => v.status === 201)).toHaveLength(1);
    expect(
      (await prisma.wallet.findUniqueOrThrow({ where: { userId: r2.user.id } })).balance >= 0n,
    ).toBe(true);
  });
});

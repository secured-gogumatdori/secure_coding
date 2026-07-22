import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const stamp = Date.now().toString().slice(-7);
const userA = `e2ea_${stamp}`;
const userB = `e2eb_${stamp}`;
const password = process.env.E2E_USER_PASSWORD ?? `Aa!9-${randomUUID()}`;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function signup(page: Page, username: string, name: string) {
  await page.goto('/signup');
  await page.getByLabel('아이디').fill(username);
  await page.getByLabel('표시 이름').fill(name);
  await page.getByLabel('비밀번호').fill(password);
  await page.getByRole('button', { name: '가입하고 로그인' }).click();
  await expect(page.getByRole('link', { name: '마이페이지' })).toBeVisible();
}
async function login(page: Page, username: string, secret: string) {
  await page.goto('/login');
  await page.getByLabel('아이디').fill(username);
  await page.getByLabel('비밀번호').fill(secret);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('link', { name: '마이페이지' })).toBeVisible();
}
async function logout(page: Page) {
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible();
}

test('가입→상품→채팅→신고→송금→관리자 검토→RBAC', async ({ page }) => {
  test.setTimeout(60_000);
  await signup(page, userA, '사용자에이');
  await page.goto('/products/new');
  await page.getByLabel('상품명').fill(`E2E 안전 상품 ${stamp}`);
  await page.getByLabel('설명').fill('브라우저 자동화 테스트 상품입니다.');
  await page.getByLabel('가격 (정수 KRW)').fill('25000');
  await page
    .getByLabel(/상품 사진/)
    .setInputFiles({ name: 'item.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`E2E 안전 상품`) })).toBeVisible();
  await logout(page);
  await signup(page, userB, '사용자비');
  await page.goto(`/search?q=${encodeURIComponent(`E2E 안전 상품 ${stamp}`)}`);
  await page.getByRole('link', { name: new RegExp('E2E 안전 상품') }).click();
  await page.getByRole('link', { name: '판매자에게 연락' }).click();
  await page.getByRole('button', { name: '1대1 채팅' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 5000 });
  await page.getByLabel('메시지').fill('상품을 구매하고 싶습니다.');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('상품을 구매하고 싶습니다.')).toBeVisible();
  await page.goto(`/search?q=${encodeURIComponent(`E2E 안전 상품 ${stamp}`)}`);
  await page.getByRole('link', { name: new RegExp('E2E 안전 상품') }).click();
  await page.getByRole('link', { name: '상품 신고' }).click();
  await page.getByLabel(/신고 사유/).fill('자동화 테스트를 위한 검토 가능한 신고 사유입니다.');
  await page.getByRole('button', { name: '신고 제출' }).click();
  await expect(page.getByRole('heading', { name: new RegExp('E2E 안전 상품') })).toBeVisible();
  await page.goto('/wallet');
  await page.getByLabel('받는 사용자 검색').fill(userA);
  await page.getByRole('button', { name: /사용자에이/ }).click();
  await page.getByLabel('금액 (정수 KRW)').fill('1000');
  await page.getByRole('button', { name: '송금 내용 확인' }).click();
  await page.getByRole('button', { name: '확인하고 송금' }).click();
  await expect(page.getByText('송금이 완료되었습니다.')).toBeVisible();
  await logout(page);
  await login(page, process.env.ADMIN_USERNAME ?? 'admin_user', process.env.ADMIN_PASSWORD!);
  await expect(page.getByRole('link', { name: '관리자' })).toBeVisible();
  await page.goto('/admin/reports');
  await page
    .getByRole('row')
    .filter({ hasText: userB })
    .getByRole('button', { name: '승인' })
    .click();
  await logout(page);
  await login(page, userB, password);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '403' })).toBeVisible();

  // 반복 실행해도 상품 목록에 자동화 테스트 데이터가 남지 않도록 생성한 상품을 soft delete한다.
  await logout(page);
  await login(page, userA, password);
  await page.goto(`/search?q=${encodeURIComponent(`E2E 안전 상품 ${stamp}`)}`);
  await page.getByRole('link', { name: new RegExp('E2E 안전 상품') }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByRole('heading', { name: '내 상품 관리' })).toBeVisible();
});

# 개발 과정 보안 약점과 변경 사항

이 문서는 설계·구현·실행 검증 중 실제로 발견해 수정한 보안 및 검증 약점을 추적한다. 단순히 “조치 완료”라고 기록하지 않고, **어느 파일의 어떤 부분을 어떤 방식으로 수정했는지** 재현할 수 있도록 작성한다. 취약한 예제 코드는 최종 소스에 남기지 않았다.

아래 `기존 내용` 코드 블록은 당시 기록된 변경 전 동작을 보여주는 최소 재현 코드다. 실제 변경 전 코드가 남아 있는 경우에는 핵심 부분을 발췌했고, 설계 단계에서 차단해 실제 소스에 들어가지 않은 경우에는 반드시 `초기 검토안(최종 소스 미반영)`이라고 표시했다. `수정 후 내용`은 현재 소스에서 핵심 부분을 발췌한 것이며 `...`는 설명과 무관한 인자·메시지의 생략을 뜻한다.

## 작성 규칙

앞으로 추가하는 모든 변경 사항은 아래 내용을 반드시 포함한다.

1. 변경 ID, 변경일, 발견 단계와 관련 CWE/OWASP를 기록한다.
2. 저장소 루트 기준 파일 경로와 함수·라우트·설정·DB 제약 등 정확한 수정 위치를 기록한다.
3. `기존 내용`에 변경 전 코드·설정·SQL 또는 초기 설계안을 기록한다. 실제 커밋에 존재하지 않았던 설계안은 `초기 검토안(최종 소스 미반영)`이라고 표시한다.
4. `수정 후 내용`에 최종 적용된 코드·설정·SQL을 기록한다. 생략이 필요한 경우에도 핵심 조건과 함수 호출은 보여준다.
5. `변경 설명`에서 입력 검증, 권한 판정, 데이터 흐름, 트랜잭션, 설정값이 어떻게 달라졌는지 설명한다.
6. 자동 테스트 이름이나 실행 명령 등 변경을 검증한 방법을 기록한다.
7. 완전히 제거하지 못한 위험이 있으면 “잔여 위험”에 명시한다.

새 항목은 다음 템플릿을 사용한다.

```text
## SEC-XX: 변경 제목

- 변경일:
- 발견 단계:
- 관련 기준:
- 수정 위치:
- 경로: 함수·라우트·설정
- 기존 내용: 변경 전 코드·설정·SQL을 코드 블록으로 작성
- 수정 후 내용: 변경 후 코드·설정·SQL을 코드 블록으로 작성
- 변경 설명: 무엇이 어떻게 달라졌는지 작성
- 보안 효과:
- 검증:
- 상태:
```

## 변경 요약

| ID     | 발견 단계     | 약점                                                 | 주요 수정 위치                                                                     | 상태 |
| ------ | ------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ---- |
| SEC-01 | 설계          | 클라이언트 식별자·권한 신뢰에 따른 IDOR              | `apps/api/src/http.ts`, `routes.products.ts`, `chat-service.ts`, `routes.admin.ts` | 해결 |
| SEC-02 | 설계          | 브라우저 저장 장기 토큰 탈취 및 세션 고정            | `apps/api/src/session.ts`, `routes.auth.ts`                                        | 해결 |
| SEC-03 | 설계          | 송금 경쟁 상태로 인한 이중 지출·음수 잔액            | `apps/api/src/routes.wallet.ts`, Prisma migration                                  | 해결 |
| SEC-04 | 설계          | 업로드 원본·MIME·파일명 신뢰                         | `apps/api/src/upload.ts`, `config.ts`, `routes.products.ts`                        | 해결 |
| SEC-05 | 구현          | nullable 신고 대상의 중복 신고 우회                  | Prisma migration, `apps/api/src/routes.reports.ts`                                 | 해결 |
| SEC-06 | 구현          | 비밀번호 변경 후 기존 세션 유지                      | `apps/api/src/routes.auth.ts`                                                      | 해결 |
| SEC-07 | 구현          | 계정 비활성화 후 기존 세션으로 보호 기능 접근        | `apps/api/src/http.ts` 및 인증 필요 Router                                         | 해결 |
| SEC-08 | 프론트 E2E    | 상품 이미지 필드가 검증 과정에서 제거                | `apps/web/src/pages.products.tsx`                                                  | 해결 |
| SEC-09 | 프론트 E2E    | Socket 비연결 상태에서 메시지 전송 유실              | `apps/web/src/pages.chat.tsx`, `apps/api/src/socket.ts`, `chat-service.ts`         | 해결 |
| SEC-10 | 공급망 검사   | 직접·전이 의존성의 알려진 취약점                     | workspace `package.json`, `package-lock.json`                                      | 해결 |
| SEC-11 | 컨테이너 검토 | API 런타임 이미지에 개발 의존성 포함                 | `apps/api/Dockerfile`                                                              | 해결 |
| SEC-12 | 테스트 검토   | Vitest와 Playwright 테스트 수집 범위 충돌            | `apps/web/vite.config.ts`, `apps/web/package.json`                                 | 해결 |
| SEC-13 | 반복 E2E      | rate limit 응답의 HTML 노출과 API 오류 규약 불일치   | `apps/api/src/app.ts`                                                              | 해결 |
| SEC-14 | 공개 전 검토  | 환경변수·개인 키·로컬 산출물의 공개 저장소 포함 위험 | `.gitignore`, `.env.example`                                                       | 해결 |
| SEC-15 | 보안 재점검   | 검증·parser·예외의 상세 내용이 응답·로그에 노출      | `apps/api/src/http.ts`, `apps/api/src/app.ts`                                      | 해결 |
| SEC-16 | 보안 재점검   | 사용자 검색의 공용 계정 상태 검사·입력 검증 누락     | `packages/shared/src/index.ts`, `apps/api/src/routes.users.ts`                     | 해결 |
| SEC-17 | 보안 재점검   | CSP의 inline style 허용                              | `apps/api/src/app.ts`, `apps/web/nginx.conf`, React component와 CSS                | 해결 |

## SEC-01: 서버 기준 인증·권한 판정으로 IDOR 차단

- 변경일: 2026-07-22
- 발견 단계: 설계
- 관련 기준: CWE-639, OWASP A01 Broken Access Control
- 수정 위치:
  - `apps/api/src/http.ts`: `requireAuth`, `requireAdmin`
  - `apps/api/src/routes.products.ts`: 상품 수정·삭제의 `sellerId` 소유권 검사
  - `apps/api/src/chat-service.ts`: `canAccessRoom`
  - `apps/api/src/socket.ts`: Socket 연결 및 `room:join` 멤버십 검사
  - `apps/api/src/routes.admin.ts`: 전체 관리자 Router의 `requireAdmin`
- 기존 내용 — 초기 검토안(최종 소스 미반영):

  ```ts
  // 요청자가 보낸 식별자와 role을 그대로 권한 판정에 사용
  const userId = req.body.userId;
  if (req.body.role === 'ADMIN') {
    next();
  }
  await prisma.product.update({ where: { id: req.params.id }, data: req.body });
  ```

- 수정 후 내용:

  ```ts
  // apps/api/src/http.ts
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, role: true, status: true },
  });
  if (user.status !== 'ACTIVE') throw new HttpError(403, 'ACCOUNT_RESTRICTED', ...);

  // apps/api/src/routes.products.ts
  if (current.sellerId !== req.session.userId && req.session.role !== 'ADMIN')
    throw new HttpError(403, 'OWNER_REQUIRED', ...);

  // apps/api/src/chat-service.ts
  return !!room && (room.type === 'GLOBAL' || room.members.length === 1);
  ```

- 변경 설명:
  - 사용자 식별자는 요청 본문에서 받지 않고 서버 세션의 `req.session.userId`만 사용하도록 했다.
  - `requireAuth`가 매 요청마다 DB의 사용자 존재 여부·role·status를 다시 확인하고, `requireAdmin`은 이 결과가 `ADMIN`일 때만 다음 Handler를 실행한다.
  - 상품 수정·삭제 전에 DB에서 상품을 조회한 뒤 `current.sellerId`와 세션 사용자 ID를 비교한다. 일치하지 않고 관리자도 아니면 `403 OWNER_REQUIRED`를 반환한다.
  - 1:1 채팅은 `ChatMember`에 해당 사용자가 포함됐는지 `canAccessRoom`으로 확인하며, REST 조회·전송과 Socket 입장·전송이 같은 검사를 사용한다.
- 보안 효과: 클라이언트가 ID나 role을 변조해도 서버 DB 관계와 세션 기준으로 권한이 결정되어 수평·수직 권한 상승을 차단한다.
- 검증: API 통합 테스트의 상품 IDOR, 채팅 멤버십, 일반 사용자 관리자 API `403` 시나리오와 Playwright RBAC 시나리오
- 상태: 해결

## SEC-02: 서버 세션과 안전한 쿠키로 인증 정보 보호

- 변경일: 2026-07-22
- 발견 단계: 설계
- 관련 기준: CWE-922, CWE-384, OWASP A07 Identification and Authentication Failures
- 수정 위치:
  - `apps/api/src/session.ts`: PostgreSQL session store와 `tiny.sid` cookie
  - `apps/api/src/routes.auth.ts`: `regenerate`, 로그인, 로그아웃
- 기존 내용 — 초기 검토안(최종 소스 미반영):

  ```ts
  // 브라우저 JavaScript가 장기 인증 토큰을 직접 보관
  localStorage.setItem('token', jwt);
  fetch('/api/me', { headers: { Authorization: `Bearer ${jwt}` } });
  ```

- 수정 후 내용:

  ```ts
  // apps/api/src/session.ts
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: config.SESSION_MAX_AGE_MS,
  }

  // apps/api/src/routes.auth.ts
  await regenerate(req);
  req.session.userId = user.id;
  req.session.csrfToken = randomBytes(32).toString('base64url');
  ```

- 변경 설명:
  - 브라우저에는 식별용 `tiny.sid`만 저장하고 실제 세션 데이터는 PostgreSQL `session` 테이블에 보관하도록 변경했다.
  - cookie에 `HttpOnly`, `SameSite=Lax`, 운영 환경 `Secure`, 제한된 `maxAge`를 설정했다.
  - 로그인 성공 직후 `req.session.regenerate()`를 호출해 기존 session ID를 폐기한 후 `userId`, role, 인증 시각, 새 CSRF token을 저장한다.
  - 로그아웃은 서버 session을 `destroy()`하고 cookie를 제거한다.
- 보안 효과: JavaScript를 통한 인증 토큰 직접 탈취 범위를 줄이고, 고정된 session ID의 재사용 및 로그아웃 후 재사용을 방지한다.
- 검증: 로그인·로그아웃·현재 사용자 API 통합 테스트, `Set-Cookie` 설정 코드 검토
- 상태: 해결

## SEC-03: 송금 원자성·멱등성·DB 불변식 강화

- 변경일: 2026-07-22
- 발견 단계: 설계
- 관련 기준: CWE-362 Concurrent Execution using Shared Resource
- 수정 위치:
  - `apps/api/src/routes.wallet.ts`: `POST /transfers`
  - `apps/api/prisma/schema.prisma`: `Transfer`, `Wallet`, `WalletEntry`
  - `apps/api/prisma/migrations/20260722000000_init/migration.sql`: 잔액·금액·자기 송금 CHECK 및 unique index
- 기존 내용 — 초기 검토안(최종 소스 미반영):

  ```ts
  const wallet = await prisma.wallet.findUnique({ where: { userId: senderId } });
  await prisma.wallet.update({
    where: { userId: senderId },
    data: { balance: wallet.balance - amount },
  });
  await prisma.wallet.update({
    where: { userId: receiverId },
    data: { balance: receiver.balance + amount },
  });
  ```

- 수정 후 내용:

  ```ts
  await prisma.$transaction(
    async (tx) => {
      const debit = await tx.wallet.updateMany({
        where: { userId: senderId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (debit.count !== 1) throw new HttpError(409, 'INSUFFICIENT_BALANCE', ...);
      // 수신 잔액, Transfer, DEBIT/CREDIT WalletEntry도 같은 transaction에 기록
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  ```

  ```sql
  ALTER TABLE "Wallet"
    ADD CONSTRAINT "Wallet_balance_nonnegative" CHECK ("balance" >= 0);
  CREATE UNIQUE INDEX "Transfer_senderId_idempotencyKey_key"
    ON "Transfer"("senderId", "idempotencyKey");
  ```

- 변경 설명:
  - 금액과 잔액을 부동소수점이 아닌 `BigInt` 정수 KRW로 처리한다.
  - 송금 전체를 Prisma `Serializable` transaction으로 실행한다.
  - `updateMany({ balance: { gte: amount } })` 조건을 만족할 때만 원자적으로 차감하고, 변경 행이 1개가 아니면 `409 INSUFFICIENT_BALANCE`를 반환한다.
  - `(senderId, idempotencyKey)` unique 제약으로 같은 요청의 재전송은 기존 송금 결과를 반환한다.
  - debit·credit `WalletEntry`를 같은 transaction에 기록하고 DB에 잔액 비음수, 송금액 양수, 자기 송금 금지 CHECK를 추가했다.
  - 직렬화 충돌 `P2034`는 성공으로 오인하지 않고 명시적인 `409 TRANSFER_CONFLICT`로 처리한다.
- 보안 효과: 동시 요청, 재전송, 애플리케이션 검증 우회 상황에서도 DB가 음수 잔액과 중복 송금을 방어한다.
- 검증: 정상·초과·자기 송금·멱등 재요청·동시 송금·음수 잔액 방지 API 통합 테스트
- 상태: 해결

## SEC-04: 이미지 디코딩·재인코딩과 안전한 파일 경로

- 변경일: 2026-07-22
- 발견 단계: 설계
- 관련 기준: CWE-434 Unrestricted Upload of File, OWASP A04 Insecure Design
- 수정 위치:
  - `apps/api/src/upload.ts`: Multer 제한, `saveImage`, `removeImage`
  - `apps/api/src/config.ts`: `MAX_UPLOAD_BYTES`, `MAX_IMAGE_PIXELS`, `UPLOAD_DIR`
  - `apps/api/src/routes.products.ts`: 저장 실패 시 생성 이미지 정리
  - `apps/api/src/app.ts`: `/uploads` 정적 제공 설정
- 기존 내용 — 초기 검토안(최종 소스 미반영):

  ```ts
  // 브라우저 MIME과 원본 파일명을 그대로 사용
  const destination = path.join(uploadDir, file.originalname);
  await writeFile(destination, file.buffer);
  ```

- 수정 후 내용:

  ```ts
  const image = sharp(file.buffer, {
    failOn: 'error',
    limitInputPixels: config.MAX_IMAGE_PIXELS,
  });
  const metadata = await image.metadata();
  if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format))
    throw new HttpError(400, 'IMAGE_TYPE_INVALID', ...);

  const filename = `${randomUUID()}.webp`;
  await image
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(dir, filename));
  ```

- 변경 설명:
  - Multer memory storage에 파일 1개와 byte 상한을 적용하고 JPEG·PNG·WebP MIME만 1차 허용한다.
  - Sharp가 실제 바이트를 디코딩하고 `metadata.format`과 pixel 상한을 다시 검사한다.
  - EXIF 방향을 적용한 뒤 최대 1920×1920으로 축소하고 WebP로 재인코딩해 원본 컨테이너와 메타데이터를 저장하지 않는다.
  - 사용자 파일명 대신 `randomUUID().webp`를 사용하고, 최종 경로의 부모가 설정된 업로드 디렉터리와 같은지 확인한다.
  - DB 저장 실패 또는 이미지 교체 실패 시 새 파일을 정리하고, 정적 경로는 dotfile을 거부한다.
- 보안 효과: MIME 위조, polyglot 원본 보존, 경로 탐색, 과도한 이미지 크기로 인한 자원 고갈 위험을 줄인다.
- 검증: 정상 이미지 등록과 MIME만 이미지인 잘못된 signature 거부 API 통합 테스트, Sharp 출력 WebP 확인
- 상태: 해결

## SEC-05: 신고 대상별 부분 unique index로 중복 신고 차단

- 변경일: 2026-07-22
- 발견 단계: 구현
- 관련 기준: CWE-20 Improper Input Validation
- 수정 위치:
  - `apps/api/prisma/migrations/20260722000000_init/migration.sql`: `Report_target_matches_type`, `Report_unique_user_target`, `Report_unique_product_target`
  - `apps/api/src/routes.reports.ts`: 자기 신고·중복 오류와 임계치 transaction
- 기존 내용 — 초기 구현안:

  ```ts
  const duplicate = await prisma.report.findFirst({
    where: { reporterId, targetUserId, targetProductId },
  });
  if (!duplicate) await prisma.report.create({ data: report });
  ```

  사전 조회만으로 중복을 판단했으며, nullable target을 구분하는 DB 제약이 없었다.

- 수정 후 내용:

  ```sql
  ALTER TABLE "Report" ADD CONSTRAINT "Report_target_matches_type" CHECK (
    ("targetType" = 'USER' AND "targetUserId" IS NOT NULL AND "targetProductId" IS NULL) OR
    ("targetType" = 'PRODUCT' AND "targetProductId" IS NOT NULL AND "targetUserId" IS NULL)
  );
  CREATE UNIQUE INDEX "Report_unique_user_target"
    ON "Report" ("reporterId", "targetUserId") WHERE "targetType" = 'USER';
  CREATE UNIQUE INDEX "Report_unique_product_target"
    ON "Report" ("reporterId", "targetProductId") WHERE "targetType" = 'PRODUCT';
  ```

- 변경 설명:
  - target type과 nullable target 두 필드의 조합이 일치하도록 XOR 성격의 `Report_target_matches_type` CHECK를 추가했다.
  - 사용자 신고와 상품 신고에 각각 `WHERE targetType = ...` 조건을 둔 partial unique index를 생성했다.
  - 애플리케이션의 자기 신고·기존 신고 검사와 DB unique 제약을 함께 사용하고, 신고 생성과 고유 신고자 수 기반 임시조치를 transaction으로 묶었다.
- 보안 효과: 동시 요청과 NULL 의미 차이로 중복 신고가 임계치를 부풀리는 것을 DB 수준에서 차단한다.
- 검증: 자기 신고 거부, 중복 신고 거부, 고유 신고자 임계치 상품 숨김 API 통합 테스트
- 상태: 해결

## SEC-06: 비밀번호 변경 시 사용자 전체 세션 폐기

- 변경일: 2026-07-22
- 발견 단계: 구현
- 관련 기준: CWE-613 Insufficient Session Expiration
- 수정 위치:
  - `apps/api/src/routes.auth.ts`: `POST /change-password`
- 기존 내용 — 초기 구현안:

  ```ts
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newPasswordHash },
  });
  res.status(204).end();
  ```

- 수정 후 내용:

  ```ts
  if (!req.session.authenticatedAt || Date.now() - req.session.authenticatedAt > 30 * 60_000)
    throw new HttpError(401, 'REAUTH_REQUIRED', ...);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordChangedAt: new Date() },
  });
  await pgPool.query("DELETE FROM session WHERE sess->>'userId' = $1", [user.id]);
  res.clearCookie('tiny.sid');
  ```

- 변경 설명:
  - 최근 30분 이내 로그인한 세션만 비밀번호 변경을 허용하고 현재 비밀번호를 Argon2로 다시 검증한다.
  - 새 hash와 `passwordChangedAt`을 저장한 뒤, `DELETE FROM session WHERE sess->>'userId' = $1`을 parameter binding으로 실행해 해당 사용자의 모든 서버 세션을 삭제한다.
  - 현재 브라우저 cookie도 제거하고 `204`를 반환해 다시 로그인하도록 했다.
- 보안 효과: 비밀번호 변경을 계정 복구 경계로 사용해 현재 세션을 포함한 탈취 세션의 지속 사용을 차단한다.
- 검증: parameter binding과 전체 세션 삭제 코드 검토, 인증 회귀 테스트
- 상태: 해결

## SEC-07: 매 요청 ACTIVE 상태 재검증

- 변경일: 2026-07-22
- 발견 단계: 구현
- 관련 기준: CWE-284 Improper Access Control
- 수정 위치:
  - `apps/api/src/http.ts`: 공용 `requireAuth`
  - `apps/api/src/routes.auth.ts`: 프로필 변경·비밀번호 변경
  - `apps/api/src/routes.products.ts`, `routes.chats.ts`, `routes.reports.ts`, `routes.wallet.ts`: 보호 Router와 mutation
- 기존 내용 — 초기 구현안:

  ```ts
  if (!req.session.userId) throw new HttpError(401, 'AUTH_REQUIRED', '로그인이 필요합니다.');
  next();
  ```

  session 존재 여부만 확인하고 DB의 최신 사용자 상태와 role은 다시 확인하지 않았다.

- 수정 후 내용:

  ```ts
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, role: true, status: true },
  });
  if (!user) throw new HttpError(401, 'SESSION_INVALID', ...);
  if (user.status !== 'ACTIVE')
    throw new HttpError(403, 'ACCOUNT_RESTRICTED', ...);
  req.session.role = user.role;
  next();
  ```

- 변경 설명:
  - 보호 기능이 개별적인 session 존재 검사 대신 공용 `requireAuth`를 사용하도록 통일했다.
  - `requireAuth`는 매 요청마다 사용자 DB row를 조회하고 `status !== ACTIVE`이면 `403 ACCOUNT_RESTRICTED`를 반환한다.
  - DB의 최신 role도 session에 다시 반영해 권한 변경 전 session 값이 계속 사용되지 않게 했다.
  - Socket 연결과 메시지 생성도 사용자 ACTIVE 상태를 별도로 재검증한다.
- 보안 효과: 계정 상태·role 변경이 기존 session에도 즉시 적용되어 제재 우회 시간을 제거한다.
- 검증: 비활성 사용자 보호 API 접근 회귀, typecheck, 관리자 RBAC 통합 테스트
- 상태: 해결

## SEC-08: 상품 폼의 이미지 입력 검증 보존

- 변경일: 2026-07-22
- 발견 단계: 프론트엔드 E2E
- 관련 기준: CWE-20(입력 검증 품질)
- 수정 위치:
  - `apps/web/src/pages.products.tsx`: `ProductInput`, `productFormSchema`, `ProductFormPage`
- 기존 내용:

  ```ts
  type ProductInput = z.infer<typeof productSchema>;
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
  });
  ```

  `productSchema`에 없는 `image`가 resolver 결과에서 제거됐다.

- 수정 후 내용:

  ```ts
  type ProductInput = z.infer<typeof productSchema> & { image?: FileList };
  const productFormSchema = productSchema.extend({ image: z.any().optional() });
  const form = useForm<ProductInput>({
    resolver: zodResolver(productFormSchema),
  });

  const file = v.image?.item(0);
  if (file) body.set('image', file);
  if (!edit && !file) throw new Error('상품 이미지를 선택해 주세요.');
  ```

- 변경 설명:
  - 공용 상품 필드 타입에 `{ image?: FileList }`를 교차해 클라이언트 입력 타입을 정의했다.
  - 클라이언트 resolver는 `productSchema.extend({ image: z.any().optional() })`를 사용해 파일 선택값을 보존한다.
  - 신규 등록 시 첫 번째 파일이 없으면 요청 전에 오류를 내고, 존재하면 `FormData`의 `image`로 전송한다.
  - 서버의 SEC-04 검증은 그대로 유지해 프론트 검증을 보안 경계로 사용하지 않는다.
- 보안 효과: 클라이언트와 서버 검증 책임을 분리하면서 정상 이미지 입력이 누락되는 품질 문제를 해결한다.
- 검증: Playwright 가입→상품 이미지 업로드→상세 페이지 시나리오, UI 빈 필드 검증 테스트
- 상태: 해결

## SEC-09: 실시간 채팅 재연결과 REST 저장 fallback

- 변경일: 2026-07-22
- 발견 단계: 프론트엔드 E2E
- 관련 기준: CWE-400(가용성), 메시지 무결성 품질
- 수정 위치:
  - `apps/web/src/pages.chat.tsx`: `ChatPage` Socket lifecycle과 `send`
  - `apps/api/src/socket.ts`: session·Origin·상태·멤버십 검증
  - `apps/api/src/chat-service.ts`: REST와 Socket이 공유하는 `createMessage`
- 기존 내용:

  ```ts
  socketRef.current?.emit('message:send', { roomId, content: value });
  setContent('');
  ```

  Socket 객체가 없거나 연결 중이면 아무 요청도 보내지 않은 채 입력값만 사라질 수 있었다.

- 수정 후 내용:

  ```ts
  if (socket?.connected) {
    socket.emit('message:send', { roomId, content: value }, (answer) => {
      if (answer.ok) setContent('');
      else setSocketError(answer.message ?? '전송하지 못했습니다.');
    });
    return;
  }

  void api(`/chats/${roomId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: value }),
  }).then(({ message }) => {
    // query cache에 저장된 메시지를 반영
  });
  ```

- 변경 설명:
  - 개발 환경에서는 현재 hostname의 `:4000`, 배포 환경에서는 same-origin 프록시를 사용하도록 Socket URL을 구분했다.
  - connect 후 `room:join`을 다시 전송해 자동 재연결 시 채팅방 membership을 복구한다.
  - Socket 연결 오류를 UI alert로 표시하고, 비연결 상태의 전송은 `POST /chats/:roomId/messages` REST 요청으로 저장한다.
  - REST와 Socket 모두 `createMessage`를 호출해 방 membership, 사용자 ACTIVE 상태, 메시지 스키마를 동일하게 검증한다.
- 보안 효과: 연결 순간의 메시지 유실을 줄이면서 fallback 경로에서도 Socket과 같은 권한 검사를 강제한다.
- 검증: Playwright 양 사용자 1:1 채팅 시나리오, 연결 오류 alert와 메시지 표시 확인
- 상태: 해결

## SEC-10: 알려진 공급망 취약점 제거

- 변경일: 2026-07-22
- 발견 단계: 공급망 검사
- 관련 기준: CWE-1104, CWE-400, CWE-79, CWE-22 및 취약 패키지별 advisory
- 수정 위치:
  - 루트 및 workspace `package.json`
  - `package-lock.json`
- 기존 내용:

  ```text
  npm audit
  12 vulnerabilities (1 Critical, 8 High 포함)
  ```

  기존 lockfile에는 advisory 영향 범위에 속한 Vitest, Multer, Sharp, React Router, Vite, Playwright 및 관련 전이 의존성이 포함돼 있었다.

- 수정 후 내용:

  ```json
  {
    "vite": "8.1.5",
    "vitest": "4.1.10",
    "@playwright/test": "1.61.1",
    "multer": "2.2.0",
    "sharp": "0.35.3",
    "react-router-dom": "6.30.4"
  }
  ```

  ```text
  npm audit
  found 0 vulnerabilities
  ```

- 변경 설명:
  - Vitest, Vite, Playwright, Multer, Sharp, React Router 등 직접 의존성을 advisory가 해소된 버전으로 올리고 정확한 버전을 pin했다.
  - lockfile을 새 dependency graph로 갱신해 취약 전이 의존성도 교체했다.
  - 주요 버전 변경 후 lint, typecheck, API/UI/E2E, production build를 모두 다시 실행했다.
- 보안 효과: 알려진 취약 버전이 설치·빌드·테스트 환경에 재유입되는 것을 lockfile 기준으로 차단한다.
- 검증: `npm audit` 결과 0 vulnerabilities, 전체 자동화와 Docker build 통과
- 상태: 해결

## SEC-11: API 런타임 이미지에서 개발 의존성 제거

- 변경일: 2026-07-22
- 발견 단계: 컨테이너 검토
- 관련 기준: CWE-1104 Use of Unmaintained Third Party Components
- 수정 위치:
  - `apps/api/Dockerfile`: `build`, `prod-deps`, `runtime` stage
- 기존 내용 — 초기 Dockerfile 구성:

  ```dockerfile
  FROM node:22-alpine AS build
  RUN npm ci
  RUN npm run build

  FROM node:22-alpine AS runtime
  COPY --from=build /app/node_modules ./node_modules
  ```

- 수정 후 내용:

  ```dockerfile
  FROM build AS prod-deps
  RUN npm prune --omit=dev

  FROM node:22-alpine AS runtime
  COPY --from=prod-deps /app/node_modules ./node_modules
  COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
  COPY --from=build /app/apps/api/dist ./apps/api/dist
  RUN mkdir -p apps/api/uploads && chown -R node:node /app
  USER node
  ```

- 변경 설명:
  - `prod-deps` stage에서 `npm prune --omit=dev`를 실행했다.
  - runtime stage에는 prune된 root/API `node_modules`, 컴파일된 API·shared 산출물, Prisma schema만 선택적으로 복사했다.
  - runtime 파일의 소유권을 비특권 `node` 사용자에게 넘기고 `USER node`로 실행한다.
- 보안 효과: 배포 이미지의 패키지 수와 실행 권한을 줄여 공급망·컨테이너 탈취 시 공격 표면을 축소한다.
- 검증: `docker compose build`, API container healthcheck, 비특권 사용자 Dockerfile 검토
- 상태: 해결

## SEC-12: Unit/통합 테스트와 E2E 수집 범위 분리

- 변경일: 2026-07-22
- 발견 단계: 테스트 검토
- 관련 기준: CWE-693 Protection Mechanism Failure(검증 약화)
- 수정 위치:
  - `apps/web/vite.config.ts`: Vitest `exclude`
  - `apps/web/package.json`: `test`, `test:e2e`
  - `apps/web/playwright.config.ts`: Playwright `testDir`
- 기존 내용:

  ```ts
  // 별도의 exclude가 없어 tests/e2e/**도 Vitest 수집 대상
  test: {
    environment: 'jsdom',
    globals: true,
  }
  ```

- 수정 후 내용:

  ```ts
  // apps/web/vite.config.ts
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globals: true,
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  }
  ```

  ```json
  {
    "test": "vitest run",
    "test:e2e": "PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright playwright test"
  }
  ```

- 변경 설명:
  - Vitest에서 `tests/e2e/**`, `node_modules/**`, `dist/**`를 명시적으로 제외했다.
  - Playwright는 `tests/e2e`만 수집하고 별도 `test:e2e` 명령으로 실행하도록 분리했다.
  - CI에서도 unit/API 테스트와 E2E 단계를 각각 실행하도록 유지했다.
- 보안 효과: 보안 회귀 테스트가 runner 구성 오류로 누락되거나 거짓 실패로 무시되는 위험을 줄인다.
- 검증: `npm test`와 `npm run test:e2e` 각각 독립 통과
- 상태: 해결

## SEC-13: rate limit 오류를 공통 JSON으로 고정

- 변경일: 2026-07-22
- 발견 단계: 반복 E2E
- 관련 기준: CWE-209(오류 정보 노출), API 오류 처리 품질
- 수정 위치:
  - `apps/api/src/app.ts`: `rateLimitHandler`, `generalLimiter`, `authLimiter`, `reportLimiter`, `transferLimiter`
- 기존 내용:

  ```ts
  const generalLimiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
  });
  ```

  별도 Handler가 없어 라이브러리 기본 HTML/text `429` body가 반환됐다.

- 수정 후 내용:

  ```ts
  const rateLimitHandler = (req, res) =>
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      },
      requestId: req.id,
    });

  const generalLimiter = rateLimit({
    windowMs: 60_000,
    limit: config.NODE_ENV === 'test' ? 10_000 : 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
  ```

- 변경 설명:
  - 모든 limiter에 동일한 `rateLimitHandler`를 연결했다.
  - 응답을 `429`와 `{ error: { code: "RATE_LIMITED", message }, requestId }` JSON 구조로 고정했다.
  - 일반 API, 인증, 신고, 송금에 서로 다른 window/limit을 적용하되 오류 형식은 공유한다.
  - 표준 rate limit header를 사용하고 legacy header는 비활성화했다.
- 보안 효과: 과다 요청을 경로별로 제한하면서 서버 기본 HTML과 불필요한 내부 정보를 노출하지 않고 추적 가능한 오류를 제공한다.
- 검증: production limiter 반복 호출과 API/UI 오류 처리 회귀 테스트
- 상태: 해결

## SEC-14: 공개 저장소에서 로컬 비밀·산출물 제외

- 변경일: 2026-07-22
- 발견 단계: GitHub 공개 전 검토
- 관련 기준: CWE-200 Exposure of Sensitive Information
- 수정 위치:
  - `.gitignore`: 환경변수, key/certificate, 로컬 DB, 업로드, 로그, cache, IDE·테스트 산출물 규칙
  - `.env.example`: 실제 비밀값이 없는 변수명·교체용 placeholder
- 기존 내용:

  ```gitignore
  node_modules/
  dist/
  .env
  .env.*
  !.env.example
  coverage/
  playwright-report/
  test-results/
  *.log
  ```

  `.env`와 기본 산출물은 제외했지만 key/certificate, 로컬 DB, `secrets/`, IDE·임시 파일 규칙은 없었다.

- 수정 후 내용:

  ```gitignore
  .env
  .env.*
  !.env.example
  *.pem
  *.key
  *.p12
  *.pfx
  *.crt
  *.cer
  secrets/
  *.db
  *.sqlite
  *.sqlite3
  apps/api/uploads/*
  !apps/api/uploads/.gitkeep
  .vscode/
  .idea/
  .cache/
  ```

- 변경 설명:
  - `.env`, `.env.*`를 제외하고 `!.env.example`만 예외로 공개 가능하게 유지했다.
  - `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`, `*.cer`, `secrets/`를 제외했다.
  - `*.db`, `*.sqlite*`, runtime uploads, log, cache, test report, IDE 상태와 로컬 보고서 산출물을 제외했다.
  - `git ls-files`와 `git check-ignore`로 실제 `.env`와 key가 추적되지 않고 `.env.example`만 추적되는지 확인했다.
- 보안 효과: 공개 저장소 push 시 인증 비밀, 로컬 데이터, 사용자 업로드가 실수로 포함될 가능성을 줄인다.
- 검증: ignore rule별 `git check-ignore -v`, tracked secret filename 검사, `.env.example` placeholder 검토
- 상태: 해결

## SEC-15: 오류 응답·로그에서 내부 상세 제거

- 변경일: 2026-07-23
- 발견 단계: 인젝션·정보 노출 보안 재점검
- 관련 기준: CWE-209 Generation of Error Message Containing Sensitive Information
- 수정 위치:
  - `apps/api/src/http.ts`: `errorHandler`
  - `apps/api/src/app.ts`: API 및 전체 경로의 마지막 404 Handler
  - `apps/api/tests/security-http.test.ts`: DB 없이 실행 가능한 오류 노출 회귀 테스트
  - `apps/api/tests/api.test.ts`: 실제 API 검증·malformed JSON·경로 조작 테스트
- 기존 내용:

  ```ts
  if (error instanceof ZodError)
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력값을 확인해 주세요.',
        details: error.flatten(),
      },
      requestId: req.id,
    });

  req.log?.error({ err: error }, 'request failed');
  ```

  Zod의 field별 상세를 클라이언트에 반환했고, 예상하지 못한 Error 객체 전체를 logger에 전달해 message·stack·driver metadata가 로그에 포함될 수 있었다. JSON parser, body 크기, Multer 오류도 별도 안전 응답으로 분류하지 않았다.

- 수정 후 내용:

  ```ts
  if (error instanceof ZodError)
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '입력값을 확인해 주세요.' },
      requestId: req.id,
    });

  if (bodyError?.type === 'entity.parse.failed')
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: '요청 본문 형식을 확인해 주세요.' },
      requestId: req.id,
    });

  req.log?.error(
    {
      errorName: safeLogValue(unknownError?.name),
      errorCode: safeLogValue(unknownError?.code),
    },
    'request failed',
  );
  ```

  ```ts
  app.use((_req, _res, next) =>
    next(new HttpError(404, 'NOT_FOUND', '요청한 경로를 찾을 수 없습니다.')),
  );
  ```

- 변경 설명:
  - validation 응답에서 `error.flatten()`을 제거하고 고정 code·message·requestId만 반환한다.
  - malformed JSON, body 크기 초과, Multer 파일 크기·형식 오류를 각각 고정된 `400`/`413` JSON으로 변환하며 parser와 field 내부 문구는 반환하지 않는다.
  - 예상하지 못한 오류는 `message`, `stack`, Prisma/driver metadata를 로그에 넣지 않는다. 영문·숫자·`_.-`로 제한한 오류 name/code와 requestId만 남긴다.
  - `/api` 밖의 알 수 없는 경로도 Express 기본 HTML 대신 공통 JSON 404를 반환한다.
- 보안 효과: 공격자가 의도적으로 validation·parser·파일·서버 오류를 발생시켜도 스키마 구조, 내부 파일 경로, stack, 접속 문자열 같은 정보를 응답이나 일반 오류 로그에서 얻기 어렵다.
- 검증: `security-http.test.ts` 5개 통과(Zod 상세 제거, Multer 일반화, Error message/stack 로그 제외, JSON/404 일반화, CSP), `api.test.ts` 보안 회귀 시나리오 추가
- 상태: 해결

## SEC-16: 사용자 검색에 공용 인증·입력 스키마 적용

- 변경일: 2026-07-23
- 발견 단계: 인젝션·접근 통제 보안 재점검
- 관련 기준: CWE-20 Improper Input Validation, CWE-284 Improper Access Control
- 수정 위치:
  - `packages/shared/src/index.ts`: `userSearchSchema`
  - `apps/api/src/routes.users.ts`: `GET /search`
  - `apps/api/tests/api.test.ts`: 빈 검색과 비활성 session 회귀 테스트
- 기존 내용:

  ```ts
  if (!req.session.userId) throw new HttpError(401, 'AUTH_REQUIRED', '로그인이 필요합니다.');
  const q = String(req.query.q ?? '')
    .trim()
    .slice(0, 30);
  ```

  session ID 존재만 확인해 DB의 최신 `ACTIVE` 상태를 검사하지 않았고, 빈 값·배열·객체 query도 `String()`과 `slice()`로 강제 변환했다.

- 수정 후 내용:

  ```ts
  export const userSearchSchema = z.object({
    q: z.string().trim().min(1).max(30),
  });
  ```

  ```ts
  usersRouter.get(
    '/search',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { q } = parse(userSearchSchema, req.query);
      // Prisma contains parameter로 username/displayName 검색
    }),
  );
  ```

- 변경 설명:
  - 공용 `requireAuth`가 session 사용자 row를 DB에서 다시 조회해 존재·role·`ACTIVE` 상태를 검사한 뒤에만 검색을 허용한다.
  - 검색 query는 Zod로 문자열·trim·최소 1자·최대 30자를 검증한다. 강제 `String()` 변환과 임의 `slice()`를 제거했다.
  - 검색 조건은 문자열 연결 SQL이 아니라 Prisma `contains` parameter를 계속 사용한다.
- 보안 효과: 제재된 사용자의 기존 session을 통한 사용자 열람과 예상하지 못한 query 자료형을 차단하며, SQL 문자열 결합 없이 검색한다.
- 검증: `auth-guard.test.ts`에서 비활성 session 거부·최신 role 반영·비문자열 검색 거부 3개 통과, 빈 검색 `400`·비활성 session `403` DB 통합 테스트 추가, lint·typecheck 통과
- 상태: 해결

## SEC-17: CSP의 inline style 허용 제거

- 변경일: 2026-07-23
- 발견 단계: XSS 방어 심층 보안 재점검
- 관련 기준: CWE-79 Improper Neutralization of Input During Web Page Generation
- 수정 위치:
  - `apps/api/src/app.ts`: Helmet CSP
  - `apps/web/nginx.conf`: 배포 Web CSP
  - `apps/web/src/pages.products.tsx`, `pages.chat.tsx`: inline style 제거
  - `apps/web/src/styles.css`: 정적 class 추가
- 기존 내용:

  ```ts
  styleSrc: ["'self'", "'unsafe-inline'"];
  ```

  ```nginx
  style-src 'self' 'unsafe-inline'
  ```

  ```tsx
  <img style={{ width: '100%', borderRadius: 12 }} ... />
  <p style={{ whiteSpace: 'pre-wrap' }}>{p.description}</p>
  <label className="field" style={{ flex: 1 }}>
  ```

- 수정 후 내용:

  ```ts
  styleSrc: ["'self'"];
  ```

  ```nginx
  default-src 'self';
  base-uri 'none';
  object-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  script-src 'self';
  style-src 'self';
  ```

  ```tsx
  <img className="product-detail-image" ... />
  <p className="product-description">{p.description}</p>
  <label className="field message-field">
  ```

- 변경 설명:
  - React component의 세 inline style을 정적 CSS class로 이동했다.
  - Helmet과 nginx CSP 양쪽에서 `'unsafe-inline'`을 제거했다.
  - nginx CSP에 `base-uri`, `object-src`, `frame-ancestors`, `form-action` 제한도 명시했다.
  - 사용자 상품명·설명·채팅 내용은 React text node로 계속 렌더링하며 `dangerouslySetInnerHTML`은 사용하지 않는다.
- 보안 효과: 저장형 입력이 별도 취약점과 결합되더라도 inline script/style 실행 가능성을 줄이고, base·object·frame 기반 주입을 추가로 제한한다.
- 검증: CSP header 단위 테스트, 저장형 XSS 문자열을 text node로 렌더링하는 Web 회귀를 포함한 UI 테스트 8개 통과, production build 통과, `dangerouslySetInnerHTML` 및 inline `style={{...}}` 정적 검색 0건
- 상태: 해결

## 2026-07-23 재점검 검증 제한

- DB 비의존 보안 테스트 8개, Web UI 테스트 8개, lint, typecheck, production build는 통과했다.
- PostgreSQL이 필요한 API 통합 테스트에는 검증·malformed JSON·경로 조작·비활성 session 검색 시나리오를 추가했으나, 점검 시점에 Docker Desktop의 WSL integration이 꺼져 있어 전체 DB 통합 suite를 재실행하지 못했다. Docker 연결 복구 후 `npm test`를 다시 실행해야 한다.
- 최신 npm advisory 재조회는 dependency metadata를 외부 npm registry로 전송하는 작업이 별도 승인되지 않아 실행하지 않았다. 마지막으로 완료된 `npm audit` 결과는 2026-07-22의 0 vulnerabilities이며, 현재 시점 결과로 간주해서는 안 된다.

## 잔여 위험

- MFA, 분산 rate limiter/Socket adapter, malware sandbox, 객체 스토리지, 중앙 SIEM은 단일 노드 학습 범위를 넘어 운영 전 추가해야 한다.
- E2E에서 생성한 상품은 종료 시 soft delete하도록 변경했지만, 공유 로컬 DB를 사용하면 테스트 계정·채팅·신고·송금 기록은 남을 수 있다. 통합/E2E에는 수명주기가 분리된 전용 DB를 사용해야 한다.
- 현재 `WEB_ORIGIN`은 하나의 정확한 Origin만 허용한다. 여러 기기는 README에 따라 동일한 LAN URL을 사용해야 하며, 인터넷 공개 시에는 단순 Origin 추가가 아니라 TLS, 신뢰할 수 있는 reverse proxy, 네트워크 접근 통제를 함께 적용해야 한다.
- 의존성 취약점은 새 advisory 공개에 따라 다시 생길 수 있으므로 Dependabot/CodeQL과 `npm audit`를 지속 실행해야 한다.

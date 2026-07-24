# [WHS][Tiny Second-hand Shopping Platform]

## 시큐어 코딩 과제

**4반 고현선(1503)**

<!-- PAGE BREAK -->

## 1. 요구사항 분석

### 1.1 이해관계자와 보호 자산

일반 사용자는 계정, 상품, 채팅, 신고, 데모 송금을 사용한다. 관리자는 제재와 복구를 수행하고 운영자는 배포, 로그, 백업, 업데이트를 담당한다. 보호해야 할 핵심 자산은 비밀번호 hash, 서버 session과 CSRF token, 개인 채팅, 상품과 업로드, 신고 정보, 지갑 잔액·송금 원장, 관리자 권한·감사 로그다.

### 1.2 기능 요구사항과 수용 기준

| ID   | 요구사항             | 핵심 수용 기준                                                            | 결과 |
| ---- | -------------------- | ------------------------------------------------------------------------- | ---- |
| FR-1 | 회원가입·사용자 관리 | Argon2id, unique username, 현재 암호 확인, 비활성 계정 기능 차단          | 완료 |
| FR-2 | 상품 등록·조회·관리  | 공개 상태 조회, 숨김 차단, 서버 소유권 검사, 안전한 이미지, 소프트 삭제   | 완료 |
| FR-3 | 사용자 간 소통       | 전체·1:1, DB 저장, 세션·Origin·멤버십 검사, 길이·속도 제한                | 완료 |
| FR-4 | 신고와 차단          | 자기·중복 신고 차단, 고유 신고자 임계치, 임시조치와 관리자 복구           | 완료 |
| FR-5 | 데모 송금            | 정수 BigInt, 자기·초과·비활성 차단, Serializable transaction, idempotency | 완료 |
| FR-6 | 상품 검색            | 이름·설명, 가격, 상태, 정렬, 페이지, 결과 수, Prisma 안전 조회            | 완료 |
| FR-7 | 관리자 기능          | 서버 ADMIN RBAC, 통계와 전체 관리 화면, 변경 전후 감사                    | 완료 |

### 1.3 비기능·보안 요구사항

- 모바일과 데스크톱에서 사용할 수 있는 반응형 한국어 UI를 제공한다.
- label, alt, 키보드 focus, 오류 메시지, 403·404 페이지를 제공한다.
- 환경변수와 비밀은 코드에 넣지 않고 `.env.example`만 공개한다.
- 입력은 서버 Zod로 다시 검증하고 출력은 React text node로 렌더링한다.
- raw SQL 문자열 결합을 사용하지 않고 Prisma query API를 사용한다.
- API, Socket, 파일 업로드, 데이터베이스에 각각 제한과 방어 계층을 둔다.
- lint, strict typecheck, 단위·통합·UI·E2E 테스트와 production build로 검증한다.

### 1.4 요구사항 해석과 범위 조정

- 이메일은 선택 사항이므로 개인정보 최소화 원칙에 따라 수집하지 않았다.
- 상품 이미지는 상품당 대표 이미지 1개로 구현했으며 다중 이미지는 향후 확장으로 남겼다.
- 신고 임계치 도달 시 영구 삭제하지 않고 상품은 `HIDDEN`, 사용자는 `DORMANT`로 임시조치한다.
- 실제 금융 연동은 하지 않고 개발 환경에서만 초기 데모 잔액을 제공한다.
- Socket 재연결 중 메시지 유실을 막기 위해 동일한 서버 멤버십 검사를 사용하는 REST 저장 fallback을 추가했다.

## 2. 개발 방법과 AI 도구 활용

### 2.1 개발 절차

1. 과제 문장에서 기능·보안·운영 요구사항을 FR/NFR/SEC ID로 분리했다.
2. 자산, 공격자, 신뢰 경계를 정의하고 위협 모델을 먼저 작성했다.
3. 모노레포와 공용 Zod schema, Prisma model·migration을 구성했다.
4. 인증·인가·CSRF·오류·로그 같은 공통 보안 계층을 먼저 만들었다.
5. 상품, 채팅, 신고, 송금, 관리자 순서로 API와 화면을 연결했다.
6. 자동 테스트와 실제 브라우저 흐름을 실행하며 기능 결함과 보안 약점을 수정했다.
7. 공개 저장소 기준으로 비밀·산출물·의존성·컨테이너·문서를 다시 검토했다.
8. 2차 보안 재점검에서 세션 수명주기, 공개 정보 최소화, proxy 경계, 감사 무결성을 추가 보완했다.

### 2.2 AI 도구 활용

과제 안내의 AI 적극 활용 요구에 따라 OpenAI Codex를 개발 보조 도구로 사용했다.

| 단계      | AI 활용                                                            | 검증 방식                     |
| --------- | ------------------------------------------------------------------ | ----------------------------- |
| 요구사항  | 긴 과제 문장을 기능·보안 수용 기준과 추적표로 구조화               | 원문과 `REQUIREMENTS.md` 대조 |
| 설계      | 신뢰 경계, 위협 시나리오, DB 제약, API 책임 분리 제안              | 실제 schema·route와 대조      |
| 구현      | 반복적인 TypeScript·React·테스트·문서 초안 작성 보조               | lint, typecheck, code review  |
| 보안 검토 | IDOR, XSS, SQLi, 오류 노출, session, race, upload, proxy 패턴 검색 | 단위·통합·E2E와 정적 검색     |
| 테스트    | 실패 원인 분석과 회귀 테스트 추가                                  | 명령의 실제 exit code 확인    |
| 문서      | 변경 전·후와 잔여 위험 정리                                        | Git diff와 현재 코드 대조     |

AI 출력은 그대로 신뢰하지 않았다. 구현 여부와 테스트 결과를 실제 파일과 명령 결과로 확인했으며, 실행하지 못한 검증은 보고서에서 명시적으로 제한으로 남겼다. 외부 저장소 push처럼 사용자 권한이 필요한 작업은 임의로 수행하지 않는 원칙을 적용했다.

## 3. 시스템 설계

### 3.1 전체 아키텍처

```text
[PC·모바일 브라우저]
        │ HTTP(S) + HttpOnly Session Cookie + CSRF
        │ WebSocket(WSS) + 동일 서버 Session
        ▼
[nginx / React SPA :5173]
        │ /api, /uploads, /socket.io reverse proxy
        ▼
[Express + Socket.IO API :4000]
   │ 인증·인가·Zod·CSP·CORS·Rate limit
   ├──────── Prisma ────────▶ [PostgreSQL :5432]
   └──────── Sharp ─────────▶ [WebP Upload Volume]
```

Docker 구성에서는 Web `5173`만 LAN에 노출하고 API `4000`과 PostgreSQL `5432`는 `127.0.0.1`에만 bind한다. 외부 기기는 Web reverse proxy를 통해 같은 API와 DB를 사용하므로 서로 등록한 상품과 채팅을 공유한다.

### 3.2 신뢰 경계와 책임

| 경계                  | 서버 측 검증                                                          |
| --------------------- | --------------------------------------------------------------------- |
| 브라우저 ↔ HTTP API  | session, CSRF, Zod, CORS Origin, rate limit, body size                |
| 브라우저 ↔ Socket.IO | exact Origin, PostgreSQL session reload, ACTIVE 상태, room membership |
| 일반 사용자 ↔ 관리자 | 최신 DB role을 조회하는 `requireAdmin`                                |
| API ↔ PostgreSQL     | Prisma parameter, transaction, FK·UNIQUE·CHECK                        |
| 업로드 ↔ 파일 저장소 | byte·pixel·decode format, UUID basename, WebP 재인코딩                |

### 3.3 모듈 구성

```text
apps/web/                  React SPA와 사용자·관리자 화면
apps/api/src/              Express·Socket.IO API와 보안 공통 계층
apps/api/prisma/           schema, migration, seed
packages/shared/           브라우저·서버 공용 Zod schema
docs/                      분석·설계·보안·테스트·유지보수·보고서
.github/                   CI, CodeQL, Dependabot
docker-compose.yml         DB, migration, API, nginx Web
```

프론트엔드는 화면과 사용자 경험을 담당하지만 권한 결정은 하지 않는다. API route는 입력 parsing과 transaction 조정을 담당하고, `http.ts`, `chat-service.ts`, `upload.ts` 같은 공용 모듈이 인증·채팅 멤버십·파일 검사를 일관되게 적용한다.

## 4. 데이터베이스 설계

### 4.1 주요 엔터티 관계

```text
User 1 ── 1 Wallet ── N WalletEntry N ── 1 Transfer
User 1 ── N Product
User N ── N ChatRoom (ChatMember) ── N Message
User 1 ── N Report ── 0..1 User 또는 0..1 Product
User(ADMIN) 1 ── N AdminAuditLog
```

### 4.2 핵심 제약

| 제약                                 | 목적                                         |
| ------------------------------------ | -------------------------------------------- |
| `User.username` UNIQUE               | 중복 계정 방지                               |
| `Wallet.userId` UNIQUE               | 사용자당 지갑 하나                           |
| `ChatRoom.directKey` UNIQUE          | 동일한 두 사용자의 1:1 방 중복 방지          |
| `(senderId, clientMessageId)` UNIQUE | Socket·REST fallback 메시지 중복 저장 방지   |
| `(senderId, idempotencyKey)` UNIQUE  | 송금 replay 중복 차감 방지                   |
| `Wallet.balance >= 0` CHECK          | 애플리케이션 우회 시에도 음수 잔액 거부      |
| `Transfer.amount > 0` CHECK          | 0원·음수 송금 거부                           |
| `senderId <> receiverId` CHECK       | 자기 송금 DB 차단                            |
| 신고 target XOR CHECK                | USER 신고와 PRODUCT 신고의 target 조합 강제  |
| 대상별 partial UNIQUE                | nullable target을 이용한 중복 신고 우회 방지 |

가격과 잔액·송금액은 PostgreSQL `BIGINT`와 TypeScript `BigInt`로 처리한다. JSON 응답에서는 정밀도 손실을 막기 위해 10진 문자열로 직렬화한다.

## 5. 기능 구현

### 5.1 인증과 사용자

비밀번호는 Argon2id로 hash하며 평문을 저장하지 않는다. 없는 username으로 로그인해도 dummy hash를 검증하고 동일한 `LOGIN_FAILED`를 반환해 계정 존재 여부와 시간 차이를 줄였다. 로그인 성공 시 session ID와 CSRF token을 재생성한다.

`requireAuth`는 session 존재만 확인하지 않고 매 요청 DB에서 사용자의 최신 role과 `ACTIVE` 상태를 확인한다. 비밀번호 변경은 최근 30분 내 인증, 현재 암호 재확인, 새 hash 저장, 해당 사용자 전체 서버 session 삭제와 Socket 종료를 수행한다.

### 5.2 상품·검색·이미지

상품 등록·목록·상세·수정·소프트 삭제와 내 상품 목록을 구현했다. 공개 목록은 `ACTIVE`, `RESERVED`, `SOLD`만 상태 필터로 조회할 수 있고, `HIDDEN` 상세는 소유자 또는 최신 DB role이 `ADMIN`인 사용자만 볼 수 있다. `DELETED` 상세는 공개하지 않는다. 검색어·가격 범위·상태·정렬·페이지 크기는 Zod로 검증하고 화면에서 페이지를 이동하며 Prisma `contains`를 사용한다.

이미지는 다음 순서로 처리한다.

1. Multer가 파일 1개와 최대 byte를 제한하고 선언 MIME을 1차 검사한다.
2. Sharp가 실제 바이트를 decode해 JPEG·PNG·WebP 형식과 pixel 상한을 확인한다.
3. EXIF 방향을 반영하고 최대 1920×1920으로 축소한다.
4. 원본 metadata와 container를 버리고 WebP로 재인코딩한다.
5. 원본 파일명 대신 `randomUUID().webp`를 저장한다.
6. DB 저장 실패나 이미지 교체 실패 시 새 파일을 정리한다.

### 5.3 전체·1:1 실시간 채팅

GLOBAL 방은 필요할 때 생성한다. 1:1 방은 두 사용자 UUID를 정렬해 `directKey`를 만들고 UNIQUE로 중복을 막는다. REST와 Socket 모두 `canAccessRoom`을 사용하므로 임의 room ID로 다른 대화를 읽거나 쓰지 못한다. 브라우저는 메시지 전송 의도마다 UUID를 만들고 Socket acknowledgement가 5초 안에 오지 않으면 같은 UUID로 REST 저장을 재시도한다. DB의 `(senderId, clientMessageId)` UNIQUE와 upsert가 응답만 유실된 경우의 중복 메시지를 막는다.

Socket handshake는 정확한 `WEB_ORIGIN`, PostgreSQL session, `ACTIVE` 상태를 검사한다. 브라우저는 WebSocket을 먼저 연결하고 차단된 환경에서 polling을 대체 transport로 시도하며, nginx는 실제 upgrade 요청에만 `Connection: upgrade`를 전달한다. `room:join`과 `message:send` 직전 session을 reload하며, 이벤트가 없는 연결도 60초마다 재검증한다. 메시지는 500자로 제한하고 사용자별 10초당 10회 bucket을 적용한다. 로그아웃·비밀번호 변경·관리자 제재·신고 자동 휴면 시 해당 사용자의 기존 Socket을 즉시 종료한다.

LAN은 `http://192.168.x.x` 형태의 비보안 context이므로 브라우저의 `crypto.randomUUID()`를 사용할 수 없다. 채팅 메시지와 송금의 멱등성 키는 이 환경에서도 허용되는 `crypto.getRandomValues()`로 UUID v4를 생성한다.

### 5.4 신고와 자동 임시조치

신고자는 request body가 아니라 session으로 식별한다. 본인 또는 본인 상품 신고, 존재하지 않는 대상, 동일 사용자의 동일 대상 중복 신고를 거부한다. 신고 생성과 고유 신고자 수 계산, 상품 `HIDDEN` 또는 사용자 `DORMANT` 전환을 하나의 transaction에서 처리한다.

관리자는 신고를 승인하거나 기각하고, 기각 시 명시적으로 대상을 복구할 수 있다. 동시에 두 관리자가 같은 신고를 검토하면 `id AND status=PENDING` 조건부 update에 성공한 한 요청만 처리된다.

### 5.5 데모 지갑과 송금

```text
브라우저: 수신자 + 정수 금액 + 송금 의도별 UUID key
      ▼
API: 자기 송금·수신자 ACTIVE·기존 key 검사
      ▼
PostgreSQL SERIALIZABLE TRANSACTION
  1) balance >= amount 조건부 원자 차감
  2) 수신 지갑 증가
  3) Transfer 생성
  4) DEBIT/CREDIT WalletEntry 두 건 생성
      ▼
전체 commit 또는 rollback
```

동일한 송금 의도의 실패 재시도는 같은 idempotency key를 사용한다. transaction 경쟁 충돌은 성공으로 오인하지 않고 `409 TRANSFER_CONFLICT`로 반환한다. Transfer와 WalletEntry를 수정·삭제하는 API는 제공하지 않아 감사 가능한 원장을 유지한다.

### 5.6 관리자

관리자는 사용자·상품·신고·메시지·송금과 사용자 수, 상품 수, 활성 상품 수, 미처리 신고 수, 송금 건수 통계를 볼 수 있다. UI 메뉴 숨김은 편의 기능일 뿐이며 모든 `/api/admin` 경로는 서버 `requireAdmin`을 통과해야 한다.

사용자 상태, 상품 상태, 신고 검토·복구, 메시지 숨김은 대상 변경 전후 JSON과 관리자·작업·대상·시각을 기록한다. 대상 변경과 감사 로그 생성을 같은 transaction에 넣어 한쪽만 저장되는 부분 실패를 막았다.

## 6. 시큐어 코딩과 위협 모델

### 6.1 적용한 방어

| 영역      | 적용 내용                                                                             |
| --------- | ------------------------------------------------------------------------------------- |
| 인증      | Argon2id, generic login error, dummy verify, 서버 session, session regenerate·destroy |
| CSRF      | session-bound 32-byte random token, 모든 상태 변경 header 검증, timing-safe compare   |
| 접근 통제 | 최신 DB role·status, owner·member, 본인 지갑 내역, 서버 관리자 RBAC                   |
| 입력      | 공용 Zod, UUID·길이·범위·enum·pagination allowlist, body·upload 상한                  |
| 출력      | React escaping, `dangerouslySetInnerHTML` 미사용, strict CSP, 내부 오류 일반화        |
| DB        | Prisma parameter query, transaction, FK·UNIQUE·CHECK·INDEX                            |
| 파일      | MIME+실제 decode, pixel/byte, rotate·resize·WebP, UUID·basename                       |
| API       | Helmet, exact CORS, timeout, 경로별 rate limit, request ID                            |
| Socket    | exact Origin, session reload, ACTIVE·membership·sender·길이·속도 검증                 |
| 로그      | Pino JSON, cookie·authorization·password 마스킹, 예외 message·stack 미기록            |
| 공급망    | version pin, lock file, Dependabot, CodeQL, CI                                        |

### 6.2 주요 위협과 대응

| 위협                  | 영향                        | 대응                                                    | 잔여 위험                  |
| --------------------- | --------------------------- | ------------------------------------------------------- | -------------------------- |
| Credential stuffing   | 계정 탈취                   | 일반화 오류, Argon2id, 로그인 rate limit                | 분산 IP, MFA 미구현        |
| Session fixation·탈취 | 사용자 가장                 | regenerate, HttpOnly·SameSite·Secure(prod), 전체 폐기   | 단말 탈취, 운영 HTTPS 필요 |
| CSRF·Stored XSS       | 사용자 의도 없는 변경       | token, React escaping, CSP                              | 브라우저·의존성 0-day      |
| SQL Injection         | DB 유출·변조                | Zod, Prisma, 유일한 SQL도 `$1` binding                  | ORM·DB 공급망              |
| IDOR·권한 상승        | 타 상품·대화·관리 기능 접근 | session identity, owner·member, 최신 role RBAC          | 새 API의 회귀 가능성       |
| 업로드 공격           | RCE·저장 XSS·DoS            | decode·reencode, 제한, 안전 이름                        | 이미지 decoder 0-day       |
| 신고 남용             | 정상 대상 임시차단          | 자기·중복·rate, 임시조치, 관리자 복구                   | 다계정 Sybil               |
| 송금 replay·race      | 중복 차감·음수 잔액         | idempotency UNIQUE, Serializable, 조건부 차감, DB CHECK | 다중 노드 부하             |
| 민감 오류·로그        | 내부 정보 노출              | 고정 오류, requestId, stack·message 미노출              | 운영 로그 접근 통제        |

## 7. 발견한 보안 약점과 변경 내용

모든 변경은 `docs/SECURITY_CHANGES.md`에 파일·함수 위치, 기존 코드, 수정 코드, 설명, 검증, 잔여 위험 형태로 기록했다. 아래는 SEC-01부터 SEC-25까지의 핵심 요약이다.

### 7.1 변경 전·후 요약

| ID     | 발견한 기존 문제                                              | 수정 후                                                           |
| ------ | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| SEC-01 | client가 보낸 user ID·role을 신뢰할 수 있는 설계 위험         | session userId, DB 최신 role, owner·member·ADMIN 서버 검사        |
| SEC-02 | 브라우저 저장 장기 token과 session fixation 위험              | PostgreSQL server session, HttpOnly cookie, 로그인 regenerate     |
| SEC-03 | 잔액 read-calculate-write 시 race·음수 가능성                 | Serializable transaction, 조건부 차감, DB CHECK, 원장             |
| SEC-04 | MIME·원본명·원본 바이트를 신뢰하는 업로드 위험                | Sharp 실제 decode·WebP 재인코딩, UUID, byte·pixel 제한            |
| SEC-05 | nullable 신고 target 때문에 앱 사전 조회만으로 중복 우회 가능 | target XOR CHECK와 대상별 partial UNIQUE                          |
| SEC-06 | password hash만 바꾸면 탈취된 기존 session이 유지             | 최근 재인증·현재 암호 확인 후 사용자 전체 session 삭제            |
| SEC-07 | 일부 인증 경로가 session userId 존재만 확인                   | 공용 `requireAuth`가 매 요청 DB의 role·ACTIVE 상태 확인           |
| SEC-08 | 상품 폼 resolver가 이미지 필드를 제거                         | client schema에 image 유지·형식·크기 검사 추가                    |
| SEC-09 | Socket 재연결 중 emit 무응답으로 메시지 유실                  | same-origin 연결, timeout, 멱등 UUID를 쓰는 REST 저장 fallback    |
| SEC-10 | 직접·전이 npm 의존성 12건 advisory                            | 안전 버전 pin·lock 갱신 후 당시 audit 0건                         |
| SEC-11 | API runtime 이미지에 개발 의존성 포함                         | multi-stage build와 production dependency prune                   |
| SEC-12 | Vitest가 Playwright E2E 파일까지 수집                         | unit/integration과 E2E 수집 범위 분리                             |
| SEC-13 | rate limit 기본 HTML과 API 오류 형식 불일치                   | 공통 `429 RATE_LIMITED` JSON handler                              |
| SEC-14 | key·DB·upload·IDE 산출물이 public 저장소에 포함될 위험        | `.gitignore` 확대, 실제 `.env` 제외, `.env.example`만 허용        |
| SEC-15 | Zod 상세, parser 문구, Error stack·message 노출               | 고정 오류 code·message·requestId, 안전 name/code만 로그           |
| SEC-16 | 사용자 검색이 단순 session과 강제 문자열 변환 사용            | `requireAuth`, 1~30자 Zod 문자열, Prisma parameter                |
| SEC-17 | CSP가 inline style을 허용                                     | React inline style을 CSS class로 이동, `unsafe-inline` 제거       |
| SEC-18 | 공개 조회가 오래된 session role과 과도한 사용자 필드 사용     | DB 최신 ACTIVE optional identity, 공개 필드·ACTIVE profile 최소화 |
| SEC-19 | 로그아웃·제재 뒤 기존 Socket이 계속 동작                      | 사용자별 Socket room, 즉시 종료, event·60초 주기 session 재검증   |
| SEC-20 | DB·API가 모든 interface에 bind되고 client IP 전달 누락        | 5432·4000 loopback bind, nginx XFF, API proxy hop 1 신뢰          |
| SEC-21 | 실패한 송금 재시도마다 새 idempotency key 생성                | 송금 내용을 확정할 때 1회 생성하고 실패 재시도에서 유지           |
| SEC-22 | 숨김 메시지가 방 preview에 노출되고 신고 동시 검토 가능       | `VISIBLE` preview 조건과 `PENDING` 원자적 선점                    |
| SEC-23 | 실행 위치별 `.env` 혼선과 CSRF 응답 무검증                    | 저장소 `.env` 한 곳, 운영 HTTPS·강한 secret, token 형식 검증      |
| SEC-24 | 관리자 변경과 감사 로그가 별도 DB 작업                        | 네 관리자 mutation에서 변경·복원·감사를 동일 transaction 처리     |
| SEC-25 | LAN에서 Socket 재연결 반복·브라우저 UUID 생성 중단            | WebSocket 우선·조건부 proxy header·HTTP 호환 난수 UUID            |

### 7.2 대표 변경 코드

기존의 세션 존재 검사:

```ts
if (!req.session.userId) {
  throw new HttpError(401, 'AUTH_REQUIRED', '로그인이 필요합니다.');
}
next();
```

수정 후 최신 계정 상태·권한 검사:

```ts
const user = await prisma.user.findUnique({
  where: { id: req.session.userId },
  select: { id: true, role: true, status: true },
});
if (!user) throw new HttpError(401, 'SESSION_INVALID', '세션이 유효하지 않습니다.');
if (user.status !== 'ACTIVE')
  throw new HttpError(403, 'ACCOUNT_RESTRICTED', '이용할 수 없는 계정입니다.');
req.session.role = user.role;
```

기존의 비원자적 송금 설계:

```ts
const wallet = await prisma.wallet.findUnique({ where: { userId: senderId } });
await prisma.wallet.update({
  where: { userId: senderId },
  data: { balance: wallet.balance - amount },
});
```

수정 후 조건부 원자 차감:

```ts
const debit = await tx.wallet.updateMany({
  where: { userId: senderId, balance: { gte: amount } },
  data: { balance: { decrement: amount } },
});
if (debit.count !== 1) throw new HttpError(409, 'INSUFFICIENT_BALANCE', '잔액이 부족합니다.');
```

기존의 상세 오류 반환:

```ts
details: error.flatten();
req.log?.error({ err: error }, 'request failed');
```

수정 후 일반화 응답·로그:

```ts
return res.status(400).json({
  error: { code: 'VALIDATION_ERROR', message: '입력값을 확인해 주세요.' },
  requestId: req.id,
});
req.log?.error({ errorName: safeName, errorCode: safeCode }, 'request failed');
```

## 8. 체크리스트와 테스트

### 8.1 체크리스트 결과

인증, session, 상품, 업로드, 채팅, 신고, 송금, 관리자, 공통 보안, 품질을 `docs/CHECKLIST.md`에서 항목별 기대 결과·실제 결과·근거와 함께 관리했다.

| 상태    | 주요 항목                                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| PASS    | Argon2id, CSRF, session regenerate, IDOR, XSS, SQLi 형태 입력, 업로드 검증, 신고 중복·임계치, 송금 동시성·멱등성, ADMIN RBAC, 공통 오류, build |
| PARTIAL | 분산 로그인 지연, 다중 노드 Socket·rate limiter, 사용자 자동 휴면 전용 통합 테스트, 운영 TLS·백업·malware 검사                                 |

### 8.2 테스트 전략

- Supertest는 실제 PostgreSQL과 session·CSRF를 사용해 인증, CRUD, 권한, 신고, 채팅, 송금 transaction을 검증한다.
- API 보안 단위 테스트는 DB mock과 Supertest로 상세 오류 노출, 최신 계정 상태, optional identity, Socket 강제 종료를 검증한다.
- React Testing Library는 폼 검증, API 오류, 관리자 메뉴, XSS text rendering, 송금 확인·재시도를 검증한다.
- Playwright는 독립된 두 browser context의 사용자 A/B와 관리자가 상품 등록, 검색, 1:1 Socket 실시간 수신, 신고, 송금, 관리자 검토, 일반 사용자 403을 수행한다.
- ESLint, strict TypeScript, Prettier, Vite production build, Docker healthcheck, 의존성 검사를 함께 사용한다.

### 8.3 실제 검증 결과

| 명령·범위                                  | 결과                                      |
| ------------------------------------------ | ----------------------------------------- |
| DB 비의존 API 보안·채팅 멱등성 테스트      | 14 PASS                                   |
| Web UI 폼·검색·페이지·송금·UUID 테스트     | 12 PASS                                   |
| `npm test` 전체 실행                       | API 24 + Web UI 12 = 36 PASS              |
| `npm run test:e2e`                         | Chromium 두 browser context 1 PASS        |
| `npm run lint`                             | PASS, error·warning 0                     |
| `npm run typecheck`                        | PASS                                      |
| `npm run build`                            | PASS                                      |
| `npm run format:check`, `git diff --check` | PASS                                      |
| `npm run db:generate`                      | PASS                                      |
| `npm run db:migrate`, `npm run db:seed`    | PASS                                      |
| `docker compose build`, `up -d --wait`     | PASS, DB·API·Web healthy                  |
| `npm audit`                                | 실행 당시 0 vulnerabilities               |
| 위험 HTML·raw SQL·상세 오류 정적 검색      | 의도하지 않은 사용 0건                    |
| Git 추적 민감 파일명 검사                  | `.env.example`, uploads `.gitkeep`만 해당 |

### 8.4 실패와 수정·재테스트 사례

| 실패                     | 원인                                 | 수정                              | 재검증       |
| ------------------------ | ------------------------------------ | --------------------------------- | ------------ |
| Prisma generate 실패     | enum 문법과 project-local cache 문제 | schema 수정과 프로젝트 cache 사용 | PASS         |
| Vitest 실행 실패         | Playwright spec까지 수집             | E2E 경로 exclude                  | PASS         |
| E2E 상품 이미지 누락     | form resolver가 FileList 제거        | client schema에 image 유지        | PASS         |
| E2E 채팅 무응답          | dev Socket proxy 재연결 시 emit 유실 | 연결 처리와 REST fallback         | PASS         |
| E2E 관리자 이동 실패     | 로그인 완료 전 navigation            | 인증 완료 link 대기               | PASS         |
| LAN 1:1 채팅·송금 중단   | Socket 전환 경쟁·HTTP UUID API 부재  | WebSocket 우선·난수 UUID helper   | PASS         |
| dependency advisory 12건 | 오래된 tool·upload·image 의존성      | 안전 버전 pin·lock 갱신           | 당시 audit 0 |
| Docker Web unhealthy     | `localhost`가 IPv6로 해석            | health URL `127.0.0.1`            | healthy      |
| 반복 로그인 429 HTML     | 기본 limiter handler                 | 공통 JSON 429 handler             | PASS         |

## 9. 실행·배포 방법

### 9.1 기본 로컬 실행

```bash
cp .env.example .env
# SESSION_SECRET, DB·관리자·seed 비밀번호를 강한 값으로 변경
docker compose up -d db
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`

### 9.2 Docker 전체 실행

```bash
cp .env.example .env
docker compose up --build
docker compose run --rm migrate npm run db:seed
```

`migrate`에서 seed를 실행해도 생성 이미지는 API와 같은 upload named volume에 저장된다. 운영 환경은 `NODE_ENV=production`, HTTPS `WEB_ORIGIN`, 48자 이상의 무작위 `SESSION_SECRET`, 실제 DB 비밀번호가 필요하다. 운영 모드에서는 일반 가입과 seed 사용자 모두 데모 초기 잔액을 지급하지 않는다.

### 9.3 PC와 모바일 동시 접속

1. 서버 PC와 폰을 같은 개인 Wi-Fi에 연결한다.
2. 서버 PC의 LAN IPv4(예: `192.168.0.15`)를 확인한다.
3. `.env`의 `WEB_ORIGIN=http://192.168.0.15:5173`을 설정한다.
4. API를 재시작하고 방화벽에서 개인 네트워크의 TCP `5173`만 허용한다.
5. PC와 폰 모두 `http://192.168.0.15:5173`으로 접속한다.
6. 서로 다른 계정으로 로그인해 상품 등록·조회와 1:1 채팅을 확인한다.

일반 기기는 Web `5173`만 사용한다. PostgreSQL `5432`와 API `4000`을 LAN이나 인터넷에 직접 공개하지 않는다. 상세 절차와 장애 해결은 `README.md`에 기록했다.

### 9.4 GitHub Repository

**Public Repository URL:** https://github.com/secured-gogumatdori/secure_coding

`.env`, key·certificate, 로컬 DB, 사용자 upload, 로그, cache, IDE·테스트 산출물은 `.gitignore`로 제외했다. 별도 제출용 DOCX와 로컬 생성 스크립트도 GitHub에서 제외하며 저장소에는 동일 내용의 `REPORT.md`만 둔다. `.env.example`에는 변수 이름과 교체해야 하는 예시값만 포함한다. 저장소에는 README 실행 방법, SECURITY 제보 정책, CI·CodeQL·Dependabot 설정이 포함된다.

## 10. 유지보수 계획

### 10.1 로그·모니터링

Pino JSON 로그의 requestId, 4xx·5xx 비율, login·report·transfer rate limit, Socket 인증 실패, transaction conflict, DB pool, 지연 p95·p99, upload volume, admin audit를 중앙 수집·경보화한다. cookie, authorization, password와 hash가 계속 마스킹되는지 회귀 검토한다.

### 10.2 데이터베이스·백업

- 매일 암호화 full backup과 WAL/PITR을 별도 계정·리전에 보관한다.
- 월 1회 격리 환경에서 복구하고 wallet·ledger 합계를 검증한다.
- schema는 새 migration으로만 변경하며 배포된 SQL을 직접 수정하지 않는다.
- 만료 session 정리와 orphan upload 보존·삭제 정책을 운영 작업으로 둔다.

### 10.3 의존성·취약점

Dependabot과 CodeQL·CI를 검토하고 Critical·High는 우선 패치한다. 변경 후 lock, audit, lint, typecheck, unit·integration·E2E, build를 다시 실행한다. 비밀이 노출되면 Git 기록에서 지우는 것만으로 끝내지 않고 즉시 폐기·회전한다.

### 10.4 사고 대응

1. 영향과 보안 사고 여부를 분류하고 변경을 동결한다.
2. requestId, 배포, DB, 감사 로그로 범위를 확인한다.
3. 노출 비밀 폐기, 인스턴스 격리, read-only 전환으로 확산을 막는다.
4. backup 복구 또는 forward fix 후 wallet 원장 불변식을 검사한다.
5. 사용자 통지, 사후 분석, 재발 방지 테스트를 남긴다.

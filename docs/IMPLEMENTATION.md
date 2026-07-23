# 구현 설명

## 구현 순서

1. 요구사항 ID와 위협/신뢰 경계를 정의했다.
2. npm workspace, 공용 Zod, Prisma schema·migration·DB 제약을 만들었다.
3. 세션/CSRF/오류/로그/rate limit 공통 계층 뒤에 인증, 상품, 채팅, 신고, 지갑, 관리자 route를 구현했다.
4. React Router 화면을 연결하고 TanStack Query로 server state, React Hook Form/Zod로 폼을 관리했다.
5. Supertest/RTL/Playwright를 실행하며 이미지 필드 stripping, Socket 개발 연결, E2E 비동기 대기 문제를 수정했다.
6. audit의 Critical/High 의존성을 업그레이드하고 0건을 확인했다.

## 모듈 역할

| 모듈                              | 역할                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `config.ts`                       | 환경변수 Zod fail-fast 검증                                                   |
| `session.ts`                      | PostgreSQL session store와 환경별 cookie                                      |
| `http.ts`                         | typed parse, active authentication, ADMIN RBAC, CSRF, 오류/BigInt 직렬화      |
| `app.ts`                          | request ID, Pino, Helmet/CSP, CORS, size/timeout/rate limit, route 조립       |
| `routes.auth.ts`                  | Argon2id, session regeneration/destroy, profile/password/session invalidation |
| `routes.products.ts`, `upload.ts` | 검색·CRUD·ownership, memory upload→Sharp safe WebP                            |
| `chat-service.ts`, `socket.ts`    | 공용 room authorization, Socket 인증/join/send/broadcast                      |
| `routes.reports.ts`               | 자기/중복 신고 방지, transaction 내 count·임시조치                            |
| `routes.wallet.ts`                | BigInt 송금, idempotency, Serializable 원자 update, 원장                      |
| `routes.admin.ts`                 | 통계·관리 동작·감사 로그                                                      |
| `pages.*.tsx`                     | 한국어 반응형 사용자/관리자 UI                                                |

## 주요 API

| 영역   | Method/Path                                                                          | 인증/권한                                    |
| ------ | ------------------------------------------------------------------------------------ | -------------------------------------------- | -------- | ------- | -------- | --------- | ----------- | ------------ |
| CSRF   | `GET /api/auth/csrf`                                                                 | 공개                                         |
| 인증   | `POST /api/auth/signup`, `login`, `logout`; `GET/PATCH /me`; `POST /change-password` | mutation CSRF, me mutation ACTIVE            |
| 사용자 | `GET /api/users/:id`, `/search`                                                      | profile 공개, search 로그인                  |
| 상품   | `GET /api/products`, `/:id`; `POST/PUT/DELETE`                                       | 판매 상태 조회 공개, 변경 ACTIVE+owner/admin |
| 채팅   | `GET rooms/messages`, `POST direct/messages`                                         | ACTIVE+membership                            |
| 신고   | `POST /api/reports`                                                                  | ACTIVE, rate limit                           |
| 지갑   | `GET /api/wallet`, `/transfers`; `POST /transfers`                                   | ACTIVE, own data, rate limit                 |
| 관리자 | `/api/admin/stats                                                                    | users                                        | products | reports | messages | transfers | audit-logs` | ACTIVE ADMIN |

상태 변경 HTTP 요청은 모두 `X-CSRF-Token`이 필요하다. 오류는 `{ error: { code, message }, requestId }` 형태다. 금액은 JSON에서 10진 문자열로 반환한다.

## 데이터베이스와 migration

Prisma schema는 엔터티/관계/unique/index를 정의한다. 최초 migration은 `price > 0`, `balance >= 0`, `amount > 0`, 자기 송금 금지, report target XOR/type 일치, target별 partial unique index를 추가했다. `Session`은 connect-pg-simple의 `session` 테이블과 매핑한다. seed는 환경변수 비밀번호를 Argon2id로 해싱하고 관리자 1, 사용자 3, 상품 5, global/direct message, report, transfer/ledger를 생성한다.

## 파일 업로드

Multer memory storage가 1파일/byte 제한과 declared MIME allowlist를 적용한다. Sharp가 실제 decode format과 pixel 수를 검사하고 자동 회전·최대 1920px 축소·WebP 재인코딩으로 EXIF/원본 payload를 제거한다. 저장 이름은 `randomUUID().webp`이며 원본 파일명은 사용하지 않는다. DB 생성 실패/이미지 교체 시 새 파일을 정리하고, 상품 소프트 삭제 이미지는 유지해 복구를 지원한다. 영구 정리 절차는 유지보수 문서에 있다.

## Socket.IO

Engine middleware가 동일한 PostgreSQL session을 읽는다. handshake의 Origin과 ACTIVE 상태를 검증하고 `room:join`마다 GLOBAL/direct membership을 확인한다. payload에 senderId는 없으며 session userId만 사용한다. 10초 10메시지 in-memory bucket과 500자 스키마를 적용한다. 클라이언트는 same-origin으로 재연결하며 연결 중단·5초 acknowledgement timeout에는 같은 `clientMessageId`를 쓰는 REST 저장 fallback을 사용한다. DB unique와 upsert가 중복 저장을 막는다. 운영은 WSS가 필수다.

## 송금 transaction

수신자/자기 송금/idempotency를 먼저 검사하고 Serializable transaction 안에서 `balance >= amount`인 wallet만 `updateMany decrement`한다. 이어 수신 지갑 increment, Transfer, DEBIT/CREDIT 두 entry를 생성한다. 어느 단계든 실패하면 rollback된다. unique race는 기존 결과로, serialization conflict는 409로 반환한다.

## 관리자

화면 guard 외에 모든 `/api/admin` route가 DB의 최신 role/status를 확인한다. 사용자/상품 상태, report review, message hide는 전후 객체를 `AdminAuditLog`에 남긴다. 송금은 조회만 가능하며 Transfer/WalletEntry 수정·삭제 API는 없다.

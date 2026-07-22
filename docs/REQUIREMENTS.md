# 요구사항 분석

## 목표와 이해관계자

Tiny Market은 로컬에서 실제 실행·검증할 수 있는 보안 중심 중고거래 교육 플랫폼이다. 구매자/판매자는 계정·상품·대화·신고·데모 송금을 사용하고, 관리자는 제재와 복구를 감사 가능하게 수행한다. 운영자/개발자는 재현 가능한 migration, CI, 로그, 백업·업데이트 문서를 사용한다.

## 기능·비기능·보안 요구사항

| ID    | 요구사항                                                  | 수용 기준                                                               |
| ----- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| FR-1  | 회원가입·로그인·공개 프로필·마이페이지·비밀번호 변경·상태 | Argon2id, unique username, 현재 비밀번호 확인, 비활성 로그인/기능 차단  |
| FR-2  | 이미지 포함 상품 CRUD·상태·내 상품                        | 비회원 ACTIVE 조회, 서버 소유권 검사, 소프트 삭제                       |
| FR-3  | 전체·1:1 실시간 채팅과 최근 내역                          | Socket 세션/Origin/멤버십 검증, 중복 direct room 방지, DB 저장          |
| FR-4  | 상품·사용자 신고, 자동 임시조치, 관리자 검토·복구         | 자기/중복 신고 차단, 고유 신고자 임계치, 감사 로그                      |
| FR-5  | 교육용 내부 지갑·송금·원장                                | 정수 BigInt, 자기/초과/비활성 차단, Serializable 트랜잭션, idempotency  |
| FR-6  | 상품명·설명 검색, 가격·상태·정렬·페이지                   | Prisma API만 사용, 검색 길이·page size 제한, 결과 수                    |
| FR-7  | 관리자 통계·사용자·상품·신고·채팅·송금·감사               | 서버 ADMIN RBAC, 변경 전후 감사 정보                                    |
| NFR-1 | 로컬 재현성과 배포 준비                                   | npm workspace, Docker Compose, migration/seed, `.env.example`           |
| NFR-2 | 반응형·접근 가능한 한국어 UI                              | label, alt, focus, 오류, 403/404, 모바일 grid                           |
| NFR-3 | 품질 검증                                                 | lint, strict typecheck, 통합/UI/E2E, build, npm audit                   |
| SEC-1 | 쿠키 세션과 CSRF                                          | 세션 재생성/삭제, HttpOnly/SameSite/Secure(prod), 상태 변경 토큰        |
| SEC-2 | 입력·출력·DB 보안                                         | 공용 Zod, React escaping, CSP, Prisma, raw SQL 없음                     |
| SEC-3 | 업로드 보안                                               | allowlist+Sharp signature, byte/pixel limit, rotate/reencode, UUID 이름 |
| SEC-4 | 접근 통제                                                 | 활성 계정, 소유자, 멤버, 관리자를 모든 관련 API에서 재검증              |
| SEC-5 | API·Socket 남용 방어                                      | strict CORS/Origin, body limit, API별 rate limit, 메시지 bucket         |
| SEC-6 | 관찰성과 비밀 관리                                        | request ID, 구조 로그, cookie/password 마스킹, 환경변수, 공통 오류      |

## 요구사항 변경·해석

- 이메일은 선택 사항이므로 수집하지 않았다. 개인정보 최소화 원칙에 따라 username만 unique로 관리한다.
- 실제 금융 연동은 범위에서 제외하고 비운영 환경의 데모 잔액만 제공한다.
- 이미지 최소 1개 요구는 현재 상품당 대표 이미지 1개로 구현했다. 다중 이미지는 향후 확장 사항이다.
- WebSocket 재연결 중 사용성이 멈추지 않도록 동일한 서버 검증을 쓰는 REST 메시지 저장 fallback을 추가했다.
- 관리자 신고 기각 시 `restoreTarget`를 명시해야 복구하며, 별도 상태 관리 API에서도 복구할 수 있다.

## 추적표

| 요구사항 ID | 구현 파일                                                   | API                                    | 화면                             | 테스트                             | 상태           |
| ----------- | ----------------------------------------------------------- | -------------------------------------- | -------------------------------- | ---------------------------------- | -------------- |
| FR-1        | `routes.auth.ts`, `User`                                    | `/api/auth/*`, `/api/users/:id`        | 로그인/가입/프로필/마이          | `api.test.ts`, `ui.test.tsx`, E2E  | 완료           |
| FR-2        | `routes.products.ts`, `upload.ts`                           | `/api/products/*`                      | 목록/검색/상세/등록/수정/내 상품 | 통합 CRUD·IDOR·XSS·SQLi, E2E       | 완료           |
| FR-3        | `socket.ts`, `chat-service.ts`, `routes.chats.ts`           | `/api/chats/*`, Socket events          | 채팅 목록/전체·1:1               | 멤버십 통합, 실시간 E2E            | 완료           |
| FR-4        | `routes.reports.ts`, `routes.admin.ts`                      | `/api/reports`, `/api/admin/reports/*` | 신고 작성/관리자 신고            | 중복·임계치 통합, E2E 검토         | 완료           |
| FR-5        | `routes.wallet.ts`, Prisma checks                           | `/api/wallet/*`                        | 지갑/확인/내역                   | 정상·초과·자기·중복·동시 통합, E2E | 완료           |
| FR-6        | `routes.products.ts`                                        | `GET /api/products`                    | 검색/필터/정렬                   | SQLi 형태 입력 통합, E2E 검색      | 완료           |
| FR-7        | `routes.admin.ts`                                           | `/api/admin/*`                         | 6개 관리자 화면                  | RBAC 통합, 관리자 E2E              | 완료           |
| SEC-1~6     | `app.ts`, `http.ts`, `session.ts`, `socket.ts`, `upload.ts` | 공통 middleware                        | 오류/403/404/경고                | 통합·E2E·lint·audit                | 완료/일부 수동 |

## 완료 판단

핵심 7개 기능과 필수 페이지/API는 구현됐다. 단일 노드용 rate limiter, 로컬 파일 저장, 이메일/알림/다중 이미지 부재는 알려진 운영 한계이며 핵심 기능 미구현으로 보지 않는다. 세부 검증 상태는 `CHECKLIST.md`를 기준으로 한다.

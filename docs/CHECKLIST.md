# 기능·보안 점검 체크리스트

상태는 실제 자동화/코드 검토 결과만 반영한다. `PASS`는 아래 근거가 확인된 항목, `PARTIAL`은 통제가 있으나 운영/자동화 검증이 추가로 필요한 항목이다.

| ID  | 영역     | 점검 항목                      | 확인 방법               | 기대 결과               | 실제 결과                 | 상태    | 근거 파일/테스트          |
| --- | -------- | ------------------------------ | ----------------------- | ----------------------- | ------------------------- | ------- | ------------------------- |
| A01 | 가입     | 서버 입력/약한 비밀번호        | invalid 통합            | 400                     | 400                       | PASS    | shared, api.test          |
| A02 | 가입     | username 중복                  | 반복 가입               | 409/DB unique           | 409                       | PASS    | schema, api.test          |
| A03 | 가입     | Argon2id/평문 미저장           | 코드·DB 모델 검토       | hash만 저장             | hash만 존재               | PASS    | routes.auth, schema       |
| A04 | 가입     | CSRF                           | header 없이 POST        | 403                     | 403                       | PASS    | http, api.test            |
| A05 | 프로필   | XSS/소개 길이                  | React/500자 schema      | text/거부               | escaping/검증             | PASS    | shared, React pages       |
| A06 | 비밀번호 | 현재 암호/재인증/session       | 코드·변경 API           | 확인 후 전 session 삭제 | 구현                      | PASS    | routes.auth               |
| A07 | 오류     | 계정 열거 방지                 | 없는/오류 login         | 같은 문구/연산          | 일반화+dummy verify       | PASS    | routes.auth, api.test     |
| S01 | 세션     | 로그인 성공/실패               | 통합                    | 200/401                 | 일치                      | PASS    | api.test                  |
| S02 | 세션     | ID 재생성/logout destroy       | 코드 검토/E2E           | fixation 방지           | regenerate/destroy        | PASS    | routes.auth, E2E          |
| S03 | 쿠키     | HttpOnly/SameSite/Secure       | 설정 검토               | 환경별 안전 설정        | Httponly/Lax/prod Secure  | PASS    | session.ts                |
| S04 | 세션     | 만료/비활성 계정               | 설정·guard              | 8h/ACTIVE만             | 구현                      | PASS    | config, requireAuth       |
| S05 | 로그인   | rate limit/반복 지연           | middleware 검토         | 15분 10회               | IP limit, 별도 지연 없음  | PARTIAL | app.ts                    |
| P01 | 상품     | 등록/목록/상세/수정/삭제       | 통합+E2E                | 정상 동작               | 통과                      | PASS    | api.test, E2E             |
| P02 | 상품     | owner/admin만 변경             | 타 사용자 통합          | 403                     | 403                       | PASS    | routes.products, api.test |
| P03 | 상품     | 가격·검색 검증                 | invalid/SQLi 형태       | 안전한 400/조회         | Prisma 처리               | PASS    | shared, api.test          |
| P04 | 상품     | Stored XSS                     | script 이름 저장/조회   | literal                 | literal                   | PASS    | api.test, React escaping  |
| P05 | 상품     | 공개 상태/숨김 미노출          | route 검토              | 판매 상태만 공개        | ACTIVE/RESERVED/SOLD 공개 | PASS    | routes.products           |
| P06 | 업로드   | MIME+signature/크기/pixel      | 유효/가짜 PNG 통합·코드 | 비이미지 400            | 400/Sharp 검증            | PASS    | upload.ts, api.test       |
| P07 | 업로드   | 경로/메타데이터                | 코드 검토               | UUID WebP/basename      | 구현                      | PASS    | upload.ts                 |
| C01 | 채팅     | 전체/1:1/DB 저장               | API/E2E                 | 메시지 저장             | 통과                      | PASS    | chat-service, E2E         |
| C02 | 채팅     | session/Origin 인증            | 코드/E2E 연결           | 비인증 거부             | 구현/연결 확인            | PASS    | socket.ts, E2E            |
| C03 | 채팅     | membership/임의 room           | outsider 통합           | 403                     | 403                       | PASS    | api.test                  |
| C04 | 채팅     | sender/길이/XSS                | 코드 검토               | session ID/500/text     | 구현                      | PASS    | shared, socket.ts         |
| C05 | 채팅     | rate limit                     | 코드 검토               | spam 제한               | 단일 노드 bucket          | PARTIAL | socket.ts                 |
| C06 | 채팅     | 비활성 차단/WSS 문서           | 코드/README             | 차단/운영 WSS           | 구현·문서화               | PASS    | socket.ts, README         |
| C07 | 채팅     | Socket 무응답 fallback 멱등성  | schema·route·UI 검토    | 중복 없는 REST 저장     | UUID unique/upsert 구현   | PARTIAL | chat-service, migration   |
| R01 | 신고     | 상품/사용자·사유·인증          | 코드/E2E                | 저장                    | 상품 E2E, 둘 다 route     | PASS    | routes.reports, E2E       |
| R02 | 신고     | 자기/중복/rate                 | 통합/코드               | 400/409/제한            | 중복 409                  | PASS    | api.test, app.ts          |
| R03 | 신고     | 상품 임계 숨김                 | 3 reporter 통합         | HIDDEN                  | HIDDEN                    | PASS    | api.test                  |
| R04 | 신고     | 사용자 임계 휴면               | transaction 코드        | DORMANT                 | 구현, 별도 자동 test 없음 | PARTIAL | routes.reports            |
| R05 | 신고     | 관리자 승인/기각/복구/audit    | E2E·코드                | review 가능             | 승인 E2E, 복구 코드       | PASS    | routes.admin, E2E         |
| W01 | 송금     | 정상·정수·자기·0/음수          | 통합/Zod                | 정상/차단               | 통과                      | PASS    | api.test, shared          |
| W02 | 송금     | 잔액 초과/비활성/없는 대상     | 통합/코드               | 409/400                 | 초과 통과, 상태 guard     | PASS    | routes.wallet, api.test   |
| W03 | 송금     | transaction rollback/음수 방지 | 동시 통합/DB checks     | 1 성공, balance>=0      | 통과                      | PASS    | api.test, migration       |
| W04 | 송금     | idempotency                    | 같은 key 반복           | 같은 transfer, 1회 차감 | 통과                      | PASS    | api.test                  |
| W05 | 송금     | 내역 권한/관리자 조회          | query/RBAC 검토         | 본인/ADMIN만            | 구현                      | PASS    | routes.wallet/admin       |
| W06 | 송금     | 원장 불변                      | API surface 검토        | 수정/삭제 없음          | 없음                      | PASS    | routes.wallet             |
| W07 | 송금     | rate limit                     | middleware 검토         | 분당 5                  | 단일 노드                 | PARTIAL | app.ts                    |
| M01 | 관리자   | 일반 사용자 UI/API 차단        | 통합+E2E                | 403                     | 통과                      | PASS    | api.test, E2E             |
| M02 | 관리자   | 사용자/상품 상태               | route/UI 검토           | 변경                    | 구현                      | PASS    | routes.admin/pages.admin  |
| M03 | 관리자   | 신고/메시지/송금/통계          | E2E·코드                | 관리/조회               | 구현                      | PASS    | routes.admin, E2E         |
| M04 | 관리자   | 감사 로그                      | 코드/UI                 | 변경 전후 기록          | 구현                      | PASS    | routes.admin/pages.admin  |
| G01 | 공통     | Helmet/CSP/CORS                | middleware 검토         | strict headers/origin   | 구현                      | PASS    | app.ts                    |
| G02 | 공통     | body/timeout/rate              | middleware              | 제한                    | 100KB/50KB/15s            | PASS    | app.ts                    |
| G03 | 공통     | 로그 마스킹/stack              | 설정·오류 handler       | 비밀/내부 미노출        | redaction/공통 500        | PASS    | logger.ts/http.ts         |
| G04 | 공통     | `.env` 제외/비밀 없음          | gitignore/검색          | 제외                    | 제외                      | PASS    | .gitignore, 최종 scan     |
| G05 | 공통     | lock/audit                     | npm                     | lock/0 vuln             | 7월 22일 0, 최신 미조회   | PARTIAL | package-lock, npm audit   |
| G06 | 공통     | 403/404/health                 | UI/API 확인             | 명시 페이지/JSON        | 구현                      | PASS    | App.tsx, app.ts           |
| Q01 | 품질     | lint/typecheck                 | 명령                    | exit 0                  | exit 0                    | PASS    | TEST_REPORT               |
| Q02 | 품질     | 통합/UI test                   | npm test                | 13 pass                 | 7월 22일 13 pass          | PASS    | TEST_REPORT               |
| Q03 | 품질     | E2E                            | Playwright              | 1 pass                  | 1 pass                    | PASS    | TEST_REPORT               |
| Q04 | 품질     | production build               | npm build               | exit 0                  | exit 0                    | PASS    | TEST_REPORT               |
| Q05 | 품질     | 7월 24일 정합성 보완 회귀      | 비DB API/Web UI         | 신규 회귀 통과          | API 14 + UI 11 pass       | PASS    | Vitest 실제 실행          |

## 수동 운영 확인 필요

Production HTTPS/WSS, 실제 reverse proxy trusted hop, 객체 스토리지/악성코드 검사, 백업 복구, 중앙 로그/SIEM, 분산 rate limit은 로컬 자동화로 PASS 처리하지 않았다. 운영 배포 전 별도 runbook 검증이 필요하다.

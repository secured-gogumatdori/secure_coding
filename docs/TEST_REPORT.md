# 테스트 보고서

## 환경

- 실행일: 2026-07-22 (Asia/Seoul)
- Node.js 24.18.0, npm 11.16.0, Docker 29.1.3
- PostgreSQL `postgres:16-alpine` Docker service, Prisma 6.8.2
- Chromium 149 / Playwright 1.61.1
- Linux 개발 환경, localhost API 4000 / Web 5173

## 전략과 데이터

Supertest는 매 실행 timestamp suffix 사용자와 실제 PostgreSQL을 사용하며 종료 시 핵심 테스트 데이터를 정리한다. valid PNG는 Sharp로 생성한다. RTL은 fetch를 격리 mock해 폼 검증·오류·권한 메뉴·송금 확인을 검사한다. Playwright는 별도 A/B 사용자를 가입시켜 상품, Socket 1:1 채팅, 신고, 데모 송금, seed 관리자 검토, 일반 사용자 403을 실제 브라우저로 수행한다.

## 최종 실행 결과

| 명령                          | 결과 | 요약                                       |
| ----------------------------- | ---- | ------------------------------------------ |
| `npm run lint`                | PASS | ESLint 0 error, 0 warning                  |
| `npm run typecheck`           | PASS | shared/API/Web/config/E2E strict typecheck |
| `npm test`                    | PASS | API 7 + UI 6 = 13 tests                    |
| `npm run test:e2e`            | PASS | 전체 사용자·관리자 scenario 1, Chromium    |
| `npm run build`               | PASS | shared/API tsc, Web Vite production bundle |
| `npm audit`                   | PASS | 0 vulnerabilities                          |
| `npm run db:migrate`          | PASS | 최초 migration 실제 PostgreSQL 적용        |
| `npm run db:seed`             | PASS | admin 1, user 3, 상품/채팅/신고/송금 생성  |
| `docker compose build`        | PASS | API/migrate/Web 멀티 스테이지 이미지 빌드  |
| `docker compose up -d --wait` | PASS | DB/API/Web healthy, migrate exit 0         |

API 통합 범위: 가입/중복/약한 비밀번호, login 성공·실패, CSRF, 인증 없는 mutation, product CRUD/IDOR, 이미지 시그니처 거부, SQLi·XSS 형태 입력, 중복/임계 신고, direct room outsider, 일반 사용자 admin 차단, 정상·초과·자기·idempotent·동시 송금과 음수 방지다.

UI 범위: login/signup/product form validation, API 오류 표시, 관리자 메뉴, 데모 경고와 송금 2단계 확인이다.

## 실패와 수정·재테스트

| 실패                  | 원인                                                    | 수정                                          | 재테스트                 |
| --------------------- | ------------------------------------------------------- | --------------------------------------------- | ------------------------ |
| Prisma generate 실패  | enum 한 줄 문법, 홈 캐시 read-only                      | multiline enum, project-local cache           | generate PASS            |
| 초기 `npm test` 실패  | Vitest가 Playwright spec 수집                           | `tests/e2e/**` exclude                        | 12 PASS                  |
| E2E 이미지 등록 실패  | resolver가 FileList strip                               | client schema 확장                            | 상품 단계 PASS           |
| E2E chat 실패         | dev Socket proxy 재연결 중 emit 무응답                  | 최초 API 직접 연결·REST fallback 적용         | Socket alert 0, E2E PASS |
| E2E 관리자 단계 실패  | 비동기 login 완료 전 navigation                         | auth 완료 link wait, explicit env path        | E2E PASS                 |
| audit 12건            | 구 버전 Vitest/Multer/Sharp/Router/Vite/Playwright 등   | 패치/안전 major로 pin, lock 갱신              | audit 0                  |
| Docker Web unhealthy  | `localhost`가 IPv6 `::1`로 해석되고 nginx는 IPv4 listen | health URL을 `127.0.0.1`로 변경               | Web healthy              |
| 반복 E2E 재로그인 429 | production login limiter 10회가 실제 발동               | API 재기동 후 최종 1회, 공통 JSON 429 handler | E2E PASS                 |

## 수동 검토

한국어 오류·데모 경고, 모바일 CSS breakpoint, label/alt/focus, 관리자 위험 경고, 신고 남용 경고, chat sender/time, 403/404를 코드와 Chromium 흐름에서 확인했다. `pandoc`/`xelatex`가 설치되지 않은 것을 확인해 PDF는 생성하지 않았으며 `REPORT.md`를 기준 산출물로 한다. README에 변환 명령을 제공한다.

## 한계

이 표는 2026년 7월 22일 당시의 수정·재테스트 기록이다. 이후 7월 24일에는 개발·배포 모두 same-origin Socket proxy로 통일하고, acknowledgement timeout과 메시지 의도 UUID unique/upsert를 추가해 REST fallback의 중복 저장도 방지했다.

## 2026년 7월 24일 정합성 보완 회귀

Docker seed upload volume, 상품 상태·페이지 UI, 클라이언트 이미지 검사, same-origin Socket과 멱등 REST fallback, 송금 충돌 안내를 보완했다. DB 비의존 API 테스트 14개와 Web UI 테스트 11개, lint·strict typecheck·production build·format 검사는 통과했다. Prisma Client 생성으로 새 schema를 검증했다.

현재 로컬 PostgreSQL에 연결할 수 없어 신규 migration deploy와 DB 통합 API 10개, E2E 1개는 다시 실행하지 못했다. 채팅 멱등성은 DB mock 단위 테스트 3개로 upsert, 키·내용 충돌 거부, 이전 payload 호환을 검증했고 실제 DB 재요청 회귀도 통합 suite에 추가했다.

- API 통합 테스트는 현재 로컬 DB를 사용했고 별도 database name 자동 생성은 CI에서 service DB로 격리한다.
- user 자동 휴면, rate limit 실제 window 소진, password session invalidation을 위한 전용 자동 테스트는 추가 가능하다.
- E2E는 Chromium 단일 브라우저이며 생성 데이터 cleanup fixture는 아직 없다.
- production TLS/WSS, multi-node, backup/restore, object storage는 환경 의존 수동/운영 검증 대상이다.

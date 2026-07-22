# Tiny Second-hand Shopping Platform

보안을 설계 중심에 둔 실행 가능한 중고거래 학습 플랫폼입니다. 회원가입, 상품과 안전한 이미지 업로드, 검색, 전체/1:1 실시간 채팅, 신고와 자동 임시조치, 교육용 데모 지갑 송금, 관리자 검토를 하나의 React·Express·PostgreSQL 애플리케이션으로 제공합니다.

> **본 지갑은 교육용 데모 기능이며 실제 화폐나 금융기관과 연결되지 않습니다.** 실제 결제나 현금성 자산에 사용하면 안 됩니다.

## 주요 기능

- Argon2id 비밀번호와 PostgreSQL 서버 세션 기반 가입·로그인·프로필·비밀번호 변경
- 상품 등록/조회/수정/소프트 삭제, 안전한 JPEG·PNG·WebP 재인코딩, 검색·가격 필터·정렬·페이지네이션
- Socket.IO 전체/1:1 채팅, 세션 인증, Origin·멤버십·상태·메시지 길이·속도 검증
- 상품/사용자 신고, 고유 신고자 임계치 자동 숨김·휴면, 관리자 승인·기각·복구
- BigInt KRW, Serializable 트랜잭션, 조건부 원자 차감, idempotency key, 불변 원장을 사용한 데모 송금
- 서버 RBAC, 관리자 통계·사용자·상품·신고·메시지·송금·감사 로그 관리
- CSRF, Helmet/CSP, CORS allowlist, 세분화된 rate limit, Zod, 구조화 로그·마스킹, 일관된 오류

## 기술 스택과 구조

React 18, TypeScript, Vite 8, React Router, TanStack Query, React Hook Form, Zod, Socket.IO Client / Node.js, Express 5, Socket.IO, Prisma, PostgreSQL 16, express-session, connect-pg-simple, Argon2id, Sharp, Pino / Vitest, Supertest, React Testing Library, Playwright를 사용합니다.

```text
apps/web/                 React SPA, 사용자·관리자 화면, Playwright
apps/api/                 Express/Socket.IO API, Prisma, seed, 통합 테스트
packages/shared/          브라우저·서버 공용 Zod 스키마
docs/                     분석·설계·위협·테스트·유지보수·종합 보고서
.github/                  CI, CodeQL, Dependabot
docker-compose.yml        PostgreSQL, migration, API, nginx Web
```

브라우저는 쿠키와 CSRF 토큰으로 API를 호출하고, API만 Prisma를 통해 데이터베이스에 접근합니다. 자세한 흐름과 ERD는 [설계 문서](docs/DESIGN.md)를 참고하세요.

## 사전 요구사항

- Node.js 20 이상(검증: 24.18.0), npm 10 이상
- Docker와 Docker Compose
- E2E 최초 1회 약 300MB의 Chromium 다운로드 공간

## 환경변수

```bash
cp .env.example .env
```

반드시 `SESSION_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, `SEED_USER_PASSWORD`를 새 강한 값으로 바꾸고 `DATABASE_URL`에도 URL 인코딩한 같은 DB 비밀번호를 반영하세요. `WEB_ORIGIN`은 허용할 정확한 프론트 Origin, `*_REPORT_THRESHOLD`는 자동 임시조치 기준, `DEMO_INITIAL_BALANCE`는 비운영 환경 신규 사용자의 데모 잔액입니다. `UPLOAD_DIR`, 업로드 byte/pixel 제한, 세션 만료, trusted proxy, 로그 수준도 환경변수로 관리합니다. `.env`는 Git에서 제외됩니다.

운영에서는 `NODE_ENV=production`, 32자 이상의 무작위 세션 비밀, TLS/HTTPS, 실제 DB 비밀번호를 사용해야 합니다. 운영 모드에는 초기 잔액을 지급하지 않습니다.

## 로컬 설치와 실행

```bash
cp .env.example .env
# .env의 세 비밀번호/비밀 값을 변경
docker compose up -d db
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- Web: http://localhost:5173
- API health: http://localhost:4000/health

seed는 `.env`의 관리자/일반 사용자 비밀번호를 Argon2id로 해싱합니다. 일반 계정은 `demo_mina`, `demo_jun`, `demo_sora`이며 모두 `SEED_USER_PASSWORD`를 사용합니다. 관리자는 `ADMIN_USERNAME`/`ADMIN_PASSWORD`로 생성됩니다. 실제 비밀번호는 문서나 저장소에 기록하지 마세요.

## Docker 전체 실행

```bash
cp .env.example .env
# .env 보안 값 변경
docker compose up --build
docker compose run --rm migrate npm run db:seed
```

`migrate`가 스키마를 적용한 뒤 API가 시작됩니다. Web은 http://localhost:5173 입니다. PostgreSQL과 업로드는 named volume에 보존됩니다.

## 빌드와 테스트

```bash
npm run lint
npm run typecheck
npm test
PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright npx playwright install chromium
npm run test:e2e
npm run build
npm audit
```

통합/E2E 테스트에는 독립 DB 사용을 권장합니다. CI는 PostgreSQL service container를 사용합니다. 로컬 기존 데이터가 있는 DB에서 E2E를 실행하면 `e2e*` 테스트 데이터가 남을 수 있습니다.

## 보안 운영 요약

- 운영 쿠키는 `HttpOnly`, `SameSite=Lax`, `Secure`; HTTPS가 필수입니다.
- WSS/TLS 종단, 주기적인 세션 정리, 감사 로그 모니터링, PostgreSQL 백업이 필요합니다.
- 로컬 업로드는 실행되지 않는 정적 경로에 UUID WebP로 저장합니다. 운영에서는 악성코드 검사·격리·서명 URL을 갖춘 객체 스토리지로 전환하세요.
- 신고 임계치는 영구 제재가 아니라 임시조치입니다. 관리자가 맥락을 검토해야 합니다.
- 현재 단일 프로세스 Socket rate bucket은 수평 확장 시 Redis 등의 공유 저장소로 교체해야 합니다.

자세한 운영 절차와 기술 부채는 [유지보수 문서](docs/MAINTENANCE.md), 취약점 제보는 [SECURITY.md](SECURITY.md)를 참고하세요.

## GitHub와 라이선스

- Repository: `https://github.com/<OWNER>/tiny-secondhand-secure-platform` (게시 후 `<OWNER>` 수정)
- License: [MIT](LICENSE)

REPORT PDF가 필요하면 Pandoc과 한글 폰트를 설치한 뒤 실행하세요.

```bash
pandoc docs/REPORT.md -o docs/REPORT.pdf --pdf-engine=xelatex
```

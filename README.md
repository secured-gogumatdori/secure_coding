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

- Node.js 20.19 이상 또는 22.12 이상(검증: 24.18.0), npm 10 이상
- Docker와 Docker Compose
- E2E 최초 1회 약 300MB의 Chromium 다운로드 공간

## 환경변수

```bash
cp .env.example .env
```

반드시 `SESSION_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, `SEED_USER_PASSWORD`를 새 강한 값으로 바꾸고 `DATABASE_URL`에도 URL 인코딩한 같은 DB 비밀번호를 반영하세요. `WEB_ORIGIN`은 허용할 정확한 프론트 Origin, `*_REPORT_THRESHOLD`는 자동 임시조치 기준, `DEMO_INITIAL_BALANCE`는 비운영 환경 신규 사용자의 데모 잔액입니다. `UPLOAD_DIR`, 업로드 byte/pixel 제한, 세션 만료, trusted proxy, 로그 수준도 환경변수로 관리합니다. `.env`는 Git에서 제외됩니다.

운영에서는 `NODE_ENV=production`, 48자 이상의 placeholder가 아닌 무작위 세션 비밀, TLS/HTTPS, 실제 DB 비밀번호를 사용해야 합니다. 운영 모드에는 초기 잔액을 지급하지 않습니다.

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
docker compose up --build --wait
docker compose run --rm migrate npm run db:seed
```

`migrate`가 스키마를 적용한 뒤 API가 시작됩니다. Web은 http://localhost:5173 입니다. `migrate`에서 seed를 실행해도 생성 이미지가 API와 같은 upload named volume에 저장되며 PostgreSQL 데이터와 함께 보존됩니다.

## 여러 기기에서 동시 접속

같은 로컬 네트워크의 PC, 노트북, 폰, 태블릿이 **하나의 Tiny Market 서버**에 접속하면 모든 기기가 같은 PostgreSQL과 업로드 저장소를 사용합니다. 따라서 A 기기에서 올린 상품을 B 기기에서 바로 조회할 수 있고, 서로 다른 계정으로 전체 채팅과 1:1 채팅을 실시간으로 이용할 수 있습니다.

### 1. 준비 사항

- 서버를 실행하는 PC와 접속할 폰·태블릿을 같은 가정/개인 Wi-Fi에 연결합니다.
- 게스트 Wi-Fi의 `AP isolation`, `Client isolation` 기능이 켜져 있으면 기기 간 접속이 차단될 수 있습니다.
- 외부 기기는 서버 PC에서 실행 중인 Docker/Node에 접속하는 것입니다. 폰에서 따로 서버를 실행하면 데이터가 공유되지 않습니다.

### 2. 서버 PC의 LAN IPv4 확인

Windows PowerShell에서 다음을 실행합니다.

```powershell
ipconfig
```

`Wi-Fi` 또는 `Ethernet` 어댑터의 `IPv4 주소`를 찾습니다. 예를 들어 `192.168.0.15`입니다. WSL에서 실행 중이라도 `vEthernet (WSL)`의 `172.x.x.x` 주소가 아니라 **Windows Wi-Fi/Ethernet IPv4**를 사용합니다.

Linux와 macOS에서는 각각 다음 명령으로 확인할 수 있습니다.

```bash
# Linux
ip -4 address

# macOS(보통 Wi-Fi가 en0인 경우)
ipconfig getifaddr en0
```

Docker/WSL 전용 가상 어댑터가 아니라 공유기에서 받은 `192.168.x.x` 또는 `10.x.x.x` 형태의 주소를 선택합니다.

### 3. `WEB_ORIGIN` 설정

`.env`의 `WEB_ORIGIN`을 앞에서 확인한 IP와 Web 포트로 변경합니다. 아래의 IP는 예시이므로 실제 PC IP로 바꿔야 합니다. 마지막에 `/`는 붙이지 않습니다.

```env
WEB_ORIGIN=http://192.168.0.15:5173
```

API와 Socket.IO는 요청 `Origin`을 이 값과 정확히 비교합니다. 따라서 이 설정을 사용할 때는 서버 PC도 `http://localhost:5173`이 아니라 `http://192.168.0.15:5173`처럼 **다른 기기와 같은 주소**로 접속해야 합니다. 그렇지 않으면 페이지는 열려도 실시간 채팅 연결이 거부될 수 있습니다.

### 4. 서버 재시작

Docker Compose로 실행 중이면 변경된 `.env`를 API 컨테이너에 다시 주입하도록 재생성합니다.

```bash
docker compose up -d --force-recreate api
docker compose ps
```

`web`, `api`, `db`가 `Up`/`healthy`인지 확인합니다. `npm run dev`로 실행했다면 기존 프로세스를 `Ctrl+C`로 종료한 후 다시 실행합니다.

```bash
npm run dev
```

Web 개발 서버는 이미 `0.0.0.0:5173`에 bind되도록 설정되어 있습니다. API도 `4000` 포트에서 실행되며, 외부 기기의 브라우저는 Web의 `/api`, `/uploads`, `/socket.io` 프록시를 통해 API를 사용합니다.

### 5. 방화벽과 접속 주소

Windows 방화벽 확인 창이 나오면 **개인 네트워크**에서 Docker Desktop/Node.js 또는 TCP `5173`의 인바운드 접속만 허용합니다. PostgreSQL `5432`와 API `4000`을 공유기 밖이나 공용 네트워크에 개방하지 마세요. 일반 사용 기기는 Web 포트 `5173`만 필요합니다.

각 기기의 브라우저에서 동일한 주소를 엽니다.

```text
http://192.168.0.15:5173
```

서버 PC에서는 되지만 폰에서 안 된다면 폰 브라우저에서 아래 주소도 확인합니다.

```text
http://192.168.0.15:5173/api/products
```

JSON 상품 목록이 보이면 PC↔폰 네트워크와 Web↔API 프록시가 모두 정상입니다.

### 6. 상품·채팅 공유 확인

1. PC와 폰에서 서로 다른 계정으로 회원가입합니다. 하나의 계정을 공유하면 1:1 채팅 상대를 만들 수 없습니다.
2. PC 계정에서 `판매하기`로 상품을 등록합니다.
3. 폰의 `상품` 탭을 새로고침하거나 검색하여 등록한 상품과 이미지를 확인합니다.
4. 폰에서 상품 상세 → `판매자에게 연락` → `1대1 채팅`으로 채팅방을 만듭니다.
5. PC 계정에서 `채팅`을 열고 같은 채팅방에 입장한 뒤, 양쪽에서 메시지가 실시간으로 보이는지 확인합니다.

채팅 기록은 PostgreSQL에 저장되므로 한쪽이 늦게 접속해도 기존 메시지를 불러옵니다. 실시간 메시지는 Socket.IO로 전달하며, 연결 또는 응답이 끊기면 같은 메시지 의도 UUID를 사용하는 REST fallback으로 저장합니다. 서버 unique 제약이 Socket·REST 중복 저장을 막습니다.

### 문제 해결

| 증상                                               | 확인할 내용                                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 폰에서 주소가 열리지 않음                          | 같은 Wi-Fi인지, Windows Wi-Fi/Ethernet IPv4가 맞는지, 게스트 Wi-Fi 기기 격리와 방화벽 `5173` 차단 여부를 확인합니다.              |
| 페이지/상품은 보이지만 실시간 채팅이 연결되지 않음 | `.env`의 `WEB_ORIGIN`이 브라우저 주소와 포트까지 완전히 같은지, API를 재시작했는지, 모든 기기가 같은 LAN URL을 쓰는지 확인합니다. |
| 다른 기기에서 상품이 보이지 않음                   | 두 기기가 같은 서버 IP로 접속했는지 확인하고 상품 탭을 새로고침합니다. 서로 다른 Docker/DB를 실행하면 데이터가 공유되지 않습니다. |
| 이미지만 보이지 않음                               | Docker의 `uploads` named volume/API 상태를 `docker compose ps` 및 `docker compose logs api`로 확인합니다.                         |
| 어제는 됐지만 오늘은 접속되지 않음                 | DHCP로 PC IP가 바뀌었는지 확인하고, 바뀌었다면 `WEB_ORIGIN`과 모든 기기의 접속 주소를 갱신한 뒤 API를 재시작합니다.               |

> **보안 주의:** 이 방법은 HTTPS가 아닌 로컬 HTTP 접속입니다. 신뢰할 수 있는 가정/개인 네트워크와 데모 계정에서만 사용하고 실제로 사용하는 비밀번호를 입력하지 마세요. 공유기 포트 포워딩으로 인터넷에 직접 공개하지 말고, 외부 접속이 필요하면 TLS/HTTPS와 VPN 또는 인증된 터널을 사용하세요.

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
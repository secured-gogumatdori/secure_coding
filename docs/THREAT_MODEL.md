# 위협 모델

## 자산·신뢰 경계·공격자

보호 자산은 계정/Argon2 hash, server session/CSRF, 상품과 업로드, 개인 채팅, 신고 정보, 지갑 잔액·불변 송금 원장, 관리자 권한·감사 로그다. 신뢰 경계는 브라우저↔HTTP/Socket API, API↔PostgreSQL, 일반 사용자↔관리자, multipart 업로드↔파일 저장소다. 공격자는 비로그인 외부자, 악성 일반 사용자, DORMANT/BANNED 사용자, 관리자 권한 상승 시도자, 공급망 공격자로 가정한다. 서버/DB 호스트 완전 장악은 애플리케이션 통제만으로 해결하지 못하는 잔여 위험이다.

| 위협 / 시나리오           | 영향                       | 적용 통제                                                                              | 잔여 위험                                |
| ------------------------- | -------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| Credential stuffing       | 계정 탈취                  | 일반화 오류, Argon2id, 로그인 rate limit, dummy verify                                 | 분산 IP 공격; MFA 미구현                 |
| Session fixation/탈취     | 사용자 가장                | 로그인 regenerate, HttpOnly/SameSite, prod Secure, logout destroy, 만료                | 단말 자체 탈취; HTTPS 운영 필요          |
| CSRF                      | 사용자 의도 없는 변경/송금 | session-bound random token, 모든 mutation header 검증, SameSite                        | XSS가 있다면 토큰 접근 가능              |
| Stored XSS                | 세션/관리 동작 탈취        | React escaping, 일반 문자열, `dangerouslySetInnerHTML` 없음, CSP                       | 브라우저/의존성 취약점                   |
| SQL Injection             | 데이터 유출·변조           | Zod, Prisma query API, raw SQL 없음; 세션 삭제만 `$1` binding                          | ORM/DB 공급망 결함                       |
| IDOR/BOLA                 | 타 상품·대화·내역 접근     | session userId, ownership, membership, own-transfer query, ADMIN RBAC                  | 새 endpoint 추가 시 회귀 가능            |
| Mass assignment           | role/status/잔액 변조      | allowlisted Zod와 명시적 Prisma data                                                   | 스키마 변경 검토 필요                    |
| 업로드 polyglot/path 공격 | RCE, 저장 XSS, DoS         | MIME allowlist+Sharp decode/signature, pixel/byte limit, WebP reencode, UUID, basename | 이미지 decoder 0-day; 운영 격리 필요     |
| 채팅 spam/임의 room       | 괴롭힘·정보 유출           | ACTIVE 검사, membership, 500자, Socket bucket, REST limit                              | 다중 노드 bucket 공유 필요               |
| 신고 남용/Sybil           | 정상 사용자·상품 임시 차단 | 자기/중복/고유 reporter, rate limit, 임시조치, 관리자 복구·audit                       | 다계정 Sybil 탐지 미구현                 |
| 송금 replay               | 중복 차감                  | sender+idempotency unique, 기존 결과 반환                                              | 키를 매번 바꾼 자동화는 rate limit 의존  |
| 송금 race                 | 음수 잔액·원장 불일치      | Serializable, conditional decrement, 한 TX, DB checks, 충돌 409                        | 재시도 UX/분산 부하 관리 필요            |
| 관리자 권한 상승          | 전면 데이터 조작           | server role lookup/RBAC, no role input, audit                                          | 관리자 계정 탈취; MFA 필요               |
| 민감 로그 노출/주입       | 비밀 유출·로그 위조        | Pino structured JSON, cookie/auth/password redaction, allowlisted request ID           | 운영 sink 접근 통제 필요                 |
| 공급망 취약점             | 빌드/런타임 장악           | pinned lock, audit 0, Dependabot, CodeQL, CI                                           | 새 advisory의 시간차                     |
| CORS/Socket Origin 우회   | 인증된 cross-site 요청     | exact `WEB_ORIGIN`, credentials allowlist, Socket origin equality                      | 복수 origin 필요 시 안전한 parser 필요   |
| 상세 오류/stack 노출      | 정찰·내부정보 유출         | 공통 한국어 오류, requestId, stack 비노출                                              | 개발 로그 접근자는 내부정보를 볼 수 있음 |

## 보안 가정과 운영 통제

- 운영 DB, 세션 비밀, 관리자 비밀번호는 secret manager에서 주입되고 최소 권한으로 보호된다.
- Reverse proxy가 TLS를 종료하며 `TRUST_PROXY`는 실제 hop 수만 설정한다.
- 업로드 volume에는 실행 권한을 주지 않고, 운영 객체 스토리지에는 content disposition·malware scan을 적용한다.
- 감사·보안 이벤트와 rate limit 지표를 중앙 수집하며, 백업은 암호화·복구 훈련한다.

## 검증

Supertest가 CSRF, 일반화 로그인 실패, IDOR, SQLi/XSS 형태 문자열, 중복/임계 신고, chat membership, RBAC, 송금 replay/동시성을 검증했다. Playwright가 사용자 간 전체 흐름과 실시간 Socket 연결, 관리자 검토, 일반 사용자 403을 검증했다. 의존성 감사 결과는 0건이다.

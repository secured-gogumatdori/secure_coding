# 유지보수 계획

## 로그와 모니터링

Pino JSON을 중앙 수집하고 `requestId`, 4xx/5xx 비율, login/report/transfer rate limit, Socket 연결 실패, transaction conflict, DB pool saturation, latency p95/p99, disk/upload volume, audit action을 경보화한다. cookie, authorization, password/hash는 마스킹 상태를 회귀 검토한다. 로그 보존 기간·접근 권한을 개인정보 정책에 맞춘다.

## 데이터베이스 백업·복구·migration

- 매일 암호화 full backup과 WAL/PITR을 별도 계정·리전에 보관한다.
- 월 1회 격리 환경에서 실제 복구와 wallet/ledger 합계 검증을 수행한다.
- schema 변경은 새 migration으로만 추가하고 이미 배포된 SQL을 수정하지 않는다.
- staging에서 `npm run db:migrate`, rollback/forward-fix, lock 시간을 검증한 후 production에 적용한다.
- Session 만료 행은 connect-pg-simple 정리 정책 또는 `DELETE FROM session WHERE expire < now()` 스케줄로 삭제한다.

## 의존성·취약점 대응

Dependabot 주간 PR과 CodeQL/CI를 검토한다. Critical/High는 영향 분석 후 우선 패치하고 lock, audit, lint/typecheck/test/E2E/build를 재실행한다. 비밀 노출은 Git 기록 수정만 하지 말고 즉시 폐기·회전한다. Node/PostgreSQL/컨테이너 base image 지원 종료일을 분기별 확인한다.

## 업로드 관리와 객체 스토리지 전환

소프트 삭제 상품 이미지는 복구 기간 동안 유지한다. 보존 기간이 지난 `DELETED` 상품 중 DB에서 참조하지 않는 basename만 별도 작업이 삭제하고, 작업 전 backup/건수/경로를 기록한다. 운영 전 객체 스토리지의 private bucket, malware scan, image proxy, signed URL, lifecycle, encryption, content disposition으로 전환한다. 업로드 경로에는 실행 권한을 부여하지 않는다.

## 관리자·신고 운영

- 감사 로그를 일/주간 검토하고 대량 상태 변경, 자기 조직 대상 반복 조치, 근무 외 시간 접근을 탐지한다.
- `PRODUCT_REPORT_THRESHOLD`, `USER_REPORT_THRESHOLD`는 오탐/처리시간/Sybil 지표를 보고 변경하며 배포 기록을 남긴다.
- 자동조치는 영구 삭제가 아니다. 승인/기각 근거를 별도 운영 티켓과 연계하고 기각 시 복구 여부를 확인한다.
- 관리자 계정은 production seed 후 password manager로 전달하고 MFA/SSO를 후속 적용한다.

## 장애 대응

1. 영향과 보안 사고 여부를 분류하고 변경을 동결한다.
2. requestId/배포/DB/감사 로그로 범위를 확인한다.
3. 노출 비밀 폐기, 문제 인스턴스 격리, read-only 전환 등 확산을 막는다.
4. 백업 복구 또는 forward fix를 수행하고 wallet 원장 불변식을 검사한다.
5. 사용자 통지·사후 분석·재발 방지 테스트를 남긴다.

## HTTPS/WSS와 배포

TLS 1.2+, HSTS, 안전한 cipher를 reverse proxy/load balancer에서 설정하고 `NODE_ENV=production`, 정확한 `TRUST_PROXY`, `WEB_ORIGIN`을 사용한다. HTTP는 HTTPS로 redirect하고 Socket은 WSS만 허용한다. session secret은 secret manager에서 회전 계획과 함께 주입한다. 무중단 회전은 복수 secret 지원을 추가한 후 수행한다.

## 사용성 재검토 결과

- 가입은 3필드로 유지하고 로그인 오류는 계정 열거 없이 이해 가능한 한 문장으로 통일했다.
- 이미지 허용 형식/크기/재인코딩을 폼에 표시하고 서버 오류를 노출한다.
- 검색 결과 수·정렬과 모바일 grid를 제공했다.
- chat에는 발신자/시각, 재연결 안내, 저장 fallback이 있다.
- 신고 앞에 남용 경고를 두고, 송금은 데모 경고와 2단계 확인을 제공한다.
- 관리 작업은 확인 prompt/경고와 감사 로그를 사용한다. 브라우저 기본 `confirm`은 향후 접근성 좋은 확인 dialog로 교체할 기술 부채다.

## 알려진 기술 부채·향후 개선

- Redis 기반 session/rate limiter/Socket adapter로 다중 노드 지원
- MFA, 이메일 검증/비밀번호 복구, 계정 잠금 정책
- 다중 이미지·object storage·malware sandbox
- 신고 사유 taxonomy, appeal, 관리자 review memo
- E2E 데이터 자동 cleanup, Firefox/WebKit·모바일 visual test
- OpenTelemetry, SIEM, ledger 정합성 정기 job

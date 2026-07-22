# Security Policy

## 지원 버전

현재 `main` 브랜치의 최신 릴리스만 보안 업데이트를 받습니다.

## 취약점 제보

공개 Issue에 세션, 비밀번호, 개인정보, 실제 공격 payload를 게시하지 마세요. 저장소 게시 후 GitHub Security Advisory의 **Report a vulnerability** 기능으로 재현 조건, 영향, 영향을 받는 버전과 제안 완화를 비공개 제보해 주세요. 아직 Security Advisory가 열리지 않았다면 저장소 소유자에게 비공개 연락 채널을 요청하십시오.

접수 후 3영업일 안에 확인을 목표로 하며, 심각도·재현 가능성·수정 범위를 평가한 뒤 수정 일정과 공개 시점을 협의합니다. 수정 릴리스 전에는 내용을 공개하지 마세요. 비밀정보가 노출됐다면 코드 삭제만으로 끝내지 말고 즉시 폐기·회전합니다.

## 보안 업데이트

Critical/High는 우선 패치하고 CI의 typecheck, lint, 통합/E2E, build, audit를 다시 수행합니다. 변경 내용과 잔여 위험은 release note와 `docs/SECURITY_CHANGES.md`에 기록합니다.

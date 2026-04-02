# Gotchas

> 프로젝트 실행 중 발견한 주의사항을 기록합니다.

- `browse/dist/` 바이너리가 git에 추적되고 있음 — `git status`에 항상 modified로 표시되나 무시할 것
- CLAUDE.md에 명시된 `.github/workflows/` 파일들이 실제로 존재하지 않음 (문서-코드 불일치)
- Python 스크립트 (sec_fetch.py, gcs_download.py)에 requirements.txt가 없음
- jojikdo.json이 27K+ tokens으로 에이전트 컨텍스트 소비가 큼

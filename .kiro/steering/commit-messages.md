---
inclusion: always
---

# Commit message rules

커밋 메시지는 저장소 루트의 `.gitmessage.txt` 템플릿을 따른다.

- 형식: `<타입>(<영역>): <주제>` — 타입은 `.gitmessage.txt` 목록의
  영어 소문자 키워드(feat, fix, style, refactor, chore, add, remove,
  move, comment, perf, test, docs, design, revert)를 사용한다.
- 주제와 본문은 반드시 한국어로 작성한다.
  (예외: 저장소 최초 커밋은 "Initial commit")
- 주제: 50자 이내, 현재형, 끝에 마침표 금지, 간단 명료하게.
- 본문(선택): 한 줄 72자 이내, "왜", "무엇을 위해" 변경했는지 설명.
- 바닥글(선택): `resolve: #99`, `ref: #122`, `related to: #30, #50`
  형식의 이슈 참조.

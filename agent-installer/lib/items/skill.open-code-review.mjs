import { defineRecipe } from '../recipe.mjs'
import { npmApp, skillsAdd, withApp } from '../recipe-helpers.mjs'
// alibaba/open-code-review(Apache-2.0, 커밋 d4f568f). skills/에 SKILL.md 2종 — open-code-review(네이티브:
// OCR이 자체 설정한 LLM 공급자로 리뷰)와 open-code-review-delegate(위임: OCR CLI가 파일 선택·규칙만 하고
// 호스트 에이전트 모델이 리뷰, API 키 불필요). plugins/*/skills/의 같은 이름 사본은 레지스트리가 하나로 합친다.
// 둘 다 ocr CLI(Go 바이너리, npm @alibaba-group/open-code-review 1.14.4가 postinstall로 GitHub 릴리스에서
// 받는다)와 Git 2.41+가 전제라 PATH에 ocr이 없으면 함께 깐다. 네이티브 모드의 공급자 설정(ocr config
// provider — 코드가 그 공급자로 전송된다)과 PR 모드의 Python 3·인증된 gh(scripts/review_pr.py, 표준
// 라이브러리만)는 설치하지 않는다. 상류 Claude·Codex·Kimi 플러그인의 슬래시 명령과 OpenCode 플러그인은
// 넣지 않는다. 훅 없음(2026-11-26 확인). 스킬 둘이라 '*' — 전역 제거를 추적할 근거가 없어 저장소 범위 전용.
export default defineRecipe({
  id: 'skill.open-code-review', category: 'skill', label: 'Open Code Review', group: '__flow',
  note: 'item.skill.open-code-review.note',
  verified: '2026-11-26',
  ...withApp(
    skillsAdd({ source: 'https://github.com/alibaba/open-code-review', skill: '*', anchor: 'open-code-review' }),
    npmApp({ bin: 'ocr', pkg: '@alibaba-group/open-code-review' }),
  ),
})

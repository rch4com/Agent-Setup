import { defineRegistrySkill } from '../catalog.mjs'
// SKILL.md는 안내 스텁이다 — 실제 워크플로 지침은 설치된 CLI가 런타임에 준다
// (`agent-browser skills get core`). 그래서 스킬 복사만으로는 반쪽이고, PATH의
// agent-browser 바이너리(npm i -g agent-browser)와 최초 1회
// `agent-browser install`(Chrome for Testing 다운로드)이 사실상 전제다 —
// note가 알린다. 본문은 Bash로 agent-browser를 부르라는 하네스 중립 문서라
// 공유 디렉터리의 10개 CLI가 함께 쓴다. frontmatter의 allowed-tools와
// hidden: true는 Claude Code 문법이라 다른 CLI는 무시한다.
// (2026-08-15 확인: skills/agent-browser/SKILL.md 단일 스킬, npm agent-browser
// 0.34.0 = vercel-labs 리포, 네이티브 바이너리는 Windows x64 포함.)
export default defineRegistrySkill({
  id: 'skill.agent-browser', label: 'agent-browser', group: '__service',
  source: 'https://github.com/vercel-labs/agent-browser',
  skill: 'agent-browser',
  note: 'item.skill.agent-browser.note',
})

import { defineRecipe } from '../recipe.mjs'
import { npmApp, skillsAdd, withApp } from '../recipe-helpers.mjs'
// vercel-labs/agent-desktop(Apache-2.0). 데스크톱 앱의 접근성 트리를 JSON으로
// 읽어 조작하는 computer-use CLI. 스킬(skills/agent-desktop)은 그 CLI를
// 부르는 지침이라 바이너리가 전제다 — PATH에 없으면 npm i -g agent-desktop으로
// 함께 깐다(상류 문서가 Windows에서 안내하는 유일한 경로, Scoop 없음). 같은
// 폴더의 플랫폼별 스킬(-windows·-macos·-linux·-ffi)은 넣지 않는다 — 상류가
// 안내하는 설치 명령이 --skill agent-desktop 하나다.
// (2026-11-12 확인: agent-browser.dev/desktop/installation, Windows 10 1809+.)
export default defineRecipe({
  id: 'skill.agent-desktop', category: 'skill', label: 'agent-desktop', group: '__service',
  note: 'item.skill.agent-desktop.note',
  verified: '2026-11-12',
  ...withApp(
    skillsAdd({ source: 'https://github.com/vercel-labs/agent-desktop', skill: 'agent-desktop' }),
    npmApp({ bin: 'agent-desktop', pkg: 'agent-desktop' }),
  ),
})

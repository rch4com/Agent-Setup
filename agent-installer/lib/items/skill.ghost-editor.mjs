import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// kurbaitaev/ghost-editor(MIT). 저장소 루트의 SKILL.md 하나다. 말하는 얼굴 영상 하나를
// 컷·자막·효과음이 입혀진 세로 릴스로 만든다. 스킬만으로는 안 돈다: ffmpeg·Node·Python·
// Whisper·OpenCV와 효과음 라이브러리(scripts/library_restore.py)는 상류 docs/INSTALL.md의
// doctor.sh가 안내하는 대로 따로 깔아야 하고, 설치기는 그것을 건드리지 않는다.
// 상류는 "Claude Code skill"이라 밝히고 스킬 위치를 ~/.claude/skills/ghost-editor로 가정한다 —
// 그래서 claudeOnly로 표시한다. 공유 스킬 설치는 다른 CLI에도 깔리지만 쓸모는 Claude Code에 있다(2026-11-16 확인).
export default defineRecipe({
  id: 'skill.ghost-editor', category: 'skill', label: 'Ghost Editor', group: '__edit', claudeOnly: true,
  note: 'item.skill.ghost-editor.note',
  verified: '2026-11-16',
  ...skillsAdd({ source: 'https://github.com/kurbaitaev/ghost-editor', skill: 'ghost-editor' }),
})

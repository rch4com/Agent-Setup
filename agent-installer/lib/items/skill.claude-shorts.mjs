import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// agricidaniel/claude-shorts(MIT). 저장소 루트의 SKILL.md 하나이고 이름은 저장소와 달리
// shorts다. 긴 영상에서 쇼츠 후보 구간을 점수 매겨 보여 주고, Remotion 자막으로 렌더해
// FFmpeg로 내보낸다. 상류의 setup.sh(faster-whisper·mediapipe·opencv·PyTorch와 remotion/
// npm install)는 설치기가 돌리지 않는다. 상류는 Unix 도구를 쓰고 Windows는 WSL 2를 권한다
// (2026-11-16 확인). 상류가 Claude Code 스킬이라 밝히고 SKILL.md가 ~/.claude/skills/shorts를 찾으므로 claudeOnly.
export default defineRecipe({
  id: 'skill.claude-shorts', category: 'skill', label: 'Claude Shorts', group: '__edit', claudeOnly: true,
  note: 'item.skill.claude-shorts.note',
  verified: '2026-11-16',
  ...skillsAdd({ source: 'https://github.com/agricidaniel/claude-shorts', skill: 'shorts' }),
})

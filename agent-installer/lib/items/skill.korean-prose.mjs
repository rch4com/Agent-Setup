import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// JellyBrick/korean-prose-skill(Apache-2.0). 커밋·PR 본문, README, i18n·UI 문구, 에러 메시지용
// 한국어 문체 스킬 하나(skills/korean-prose, skills --list로 확인, 2026-11-20). 저장소에
// docs/korean-style.md가 있으면 그 규약을 먼저 쓴다. scripts/prose.ts는 OPENROUTER_API_KEY나
// GEMINI_API_KEY로 외부 LLM을 불러 문장을 그쪽에 보내고, .ts를 직접 돌리므로 Node 22.6+가
// 필요하다. 키 없이도 SKILL.md·references/style.md 규약은 동작한다 — 이 도구는 키를 받지 않고
// note가 알린다.
export default defineRecipe({
  id: 'skill.korean-prose', category: 'skill', label: 'korean-prose', group: '__writing',
  note: 'item.skill.korean-prose.note',
  verified: '2026-11-20',
  ...skillsAdd({ source: 'https://github.com/JellyBrick/korean-prose-skill', skill: 'korean-prose' }),
})

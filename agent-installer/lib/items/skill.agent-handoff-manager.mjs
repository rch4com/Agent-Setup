import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// rch4com/agent-handoff-manager(MIT). 에이전트 사이 작업 인계를 저장·재개하는
// 스킬 하나(skills/agent-handoff-manager). 본체는 스킬 폴더의 scripts/handoff.py
// (표준 라이브러리만, Python 3.10+)라 PATH에 Python이 있어야 한다. 상류는
// Claude·Copilot 플러그인 매니페스트도 두지만 담긴 것이 같은 스킬 하나라
// 여섯 CLI가 함께 보는 공유 스킬 판을 택했다. 데이터는 대상 저장소의
// .handoffs/에 쌓인다.
export default defineRecipe({
  id: 'skill.agent-handoff-manager', category: 'skill', label: 'Agent Handoff Manager', group: '__context',
  note: 'item.skill.agent-handoff-manager.note',
  verified: '2026-11-12',
  ...skillsAdd({ source: 'https://github.com/rch4com/agent-handoff-manager', skill: 'agent-handoff-manager' }),
})

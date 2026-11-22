import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// Jakeschincariol/linkedin-agent-skill(MIT). skills/li-*/SKILL.md 11개(post·comment·reply·dm·
// inbox·human·audit·carousel·plan·profile·repurpose). instagram-agent와 같은 저자·구조다 — 상류
// Claude 마켓플레이스도 있지만 훅·명령 없이 스킬뿐이라 공유 스킬 판을 택했다. li-post/hooks.json은
// Claude 훅이 아니라 글 첫 줄 공식 데이터다. li-human의 detect.py·humanize.py는 Python 표준
// 라이브러리만 쓴다. 외부 API·브라우저 자동화는 없고, 스킬 본문이 자동 게시·스크래핑을 금지한다
// (전 SKILL.md 확인, 2026-11-22). anchor는 묶음의 중심인 li-post.
export default defineRecipe({
  id: 'skill.linkedin-agent', category: 'skill', label: 'LinkedIn Agent', group: '__social',
  note: 'item.skill.linkedin-agent.note',
  verified: '2026-11-22',
  ...skillsAdd({ source: 'https://github.com/Jakeschincariol/linkedin-agent-skill', skill: '*', anchor: 'li-post' }),
})

import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// leeandev/stop-slop-ko(MIT). 마켓플레이스 하나에 플러그인 셋(stop-slop-ko·stakeholder-brief·
// jasoseo)이 plugins/*/skills/* 아래 있고, skills --list가 중첩 경로에서 3종을 찾는다(2026-11-20).
// stop-slop-ko가 다른 둘로 라우팅하므로 함께 받는다. scripts/slop_scan.py·count.py는 Python
// 표준 라이브러리만 쓴다(docx·pptx·xlsx는 zipfile로 읽음). 자동 적용 UserPromptSubmit 훅은
// ${CLAUDE_PLUGIN_ROOT}를 쓰는 Claude 플러그인 전용이라 스킬 폴더 밖에 있어 따라오지 않는다 —
// note가 알린다.
export default defineRecipe({
  id: 'skill.stop-slop-ko', category: 'skill', label: 'stop-slop-ko', group: '__writing',
  note: 'item.skill.stop-slop-ko.note',
  verified: '2026-11-20',
  ...skillsAdd({ source: 'https://github.com/leeandev/stop-slop-ko', skill: '*', anchor: 'stop-slop-ko' }),
})

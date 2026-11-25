import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// xikhar/papercraft(MIT, 커밋 5eea4eb). skills/papercraft/SKILL.md 하나 — 팝업북 종이 공예 스타일로
// 게임·인터랙티브 장면·웹 페이지·영상을 만든다. 템플릿·키트는 브라우저에서 three.js r187을 CDN으로 받는다.
// scripts/*.py는 Python 3 + numpy·Pillow가 필요하고 capture.py는 Playwright, measure.py는 ffmpeg를 쓴다 —
// 이 도구는 설치하지 않는다. 훅·API 키 없음, 이미지 생성은 사용자가 원할 때만(2026-11-25 확인).
export default defineRecipe({
  id: 'skill.papercraft', category: 'skill', label: 'Papercraft', group: '__motion',
  note: 'item.skill.papercraft.note',
  verified: '2026-11-25',
  ...skillsAdd({ source: 'https://github.com/xikhar/papercraft', skill: 'papercraft' }),
})

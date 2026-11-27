import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// danielwh2/sprite-stacking(MIT, 커밋 0cce02e). skills/sprite-stacking에 SKILL.md 하나 — 위·옆·앞·뒤
// 4면 정사영 그림을 시각 헐(visual hull)로 깎아 슬라이스 띠로 만들고, 돌려 볼 수 있는 가짜 3D 픽셀 아트
// (스프라이트 스태킹)로 웹 Canvas·Godot·Unity·Phaser에 렌더한다. scripts/views_to_slices.py에 Python 3과
// Pillow·NumPy가 필요하고 이 도구는 설치하지 않는다. scripts/viewer.html은 외부 스크립트 없는 단독
// 페이지다. API 키·외부 네트워크·훅 없음. 스킬 폴더 약 170KB. 상류 tests/·media/는 넣지 않는다
// (2026-11-27 확인).
export default defineRecipe({
  id: 'skill.sprite-stacking', category: 'skill', label: 'Sprite Stacking', group: '__motion',
  note: 'item.skill.sprite-stacking.note',
  verified: '2026-11-27',
  ...skillsAdd({ source: 'https://github.com/danielwh2/sprite-stacking', skill: 'sprite-stacking' }),
})

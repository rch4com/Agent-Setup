import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// nyxera0x/blueprint(MIT, 커밋 2d3463e). 루트 SKILL.md 하나 — 평면도·펜 스케치·참고 이미지를 Blender 장면
// 스크립트로 옮겨 실사 3D 주택과 "스스로 지어지는" 영상을 만든다. Blender 4.2+(PATH의 blender, GPU 권장),
// Python 3과 pillow(평면도 판독은 opencv-python·numpy), ffmpeg가 필요하고 이 도구는 설치하지 않는다.
// houses/*/fetch_assets.py가 Poly Haven API에서 CC0 재질을 ~/.blueprint/polyhaven으로 받고, tools/music.py는
// ELEVENLABS_API_KEY가 있으면 ElevenLabs Music API를 부른다(없으면 효과음만, 그때 requests 필요).
// sfx/samples의 녹음 12개는 SOURCES.md상 CC0. 루트가 스킬이라 README용 docs/ GIF(약 20MB)도 함께 복사된다
// (전체 약 25MB). 훅 없음(2026-11-26 확인). 같은 이름의 intincrab/blueprint(특허 도면 설명도)와는 다른 스킬이다.
export default defineRecipe({
  id: 'skill.blueprint', category: 'skill', label: 'Blueprint', group: '__motion',
  note: 'item.skill.blueprint.note',
  verified: '2026-11-26',
  ...skillsAdd({ source: 'https://github.com/nyxera0x/blueprint', skill: 'blueprint' }),
})

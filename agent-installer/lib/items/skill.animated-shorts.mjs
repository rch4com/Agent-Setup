import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// mromidev/claude-animated-shorts(MIT, 커밋 e3b817b). 저장소 루트의 SKILL.md 하나이고 이름은
// 저장소와 달리 cartoon-3d-short다. three.js + Remotion으로 세로형 카툰 숏폼을
// 만든다 — 렌더에는 Remotion이 필요하니 skill.remotion과 함께 쓰면 좋다.
// 루트가 스킬이라 약 36MB가 복사된다. 그중 references/frames·sheets(약 18MB)는 제3자 채널 영상에서 뽑은
// 프레임이고, 상류 README가 MIT는 code와 docs에만 적용되며 이 프레임은 "style study only"라고 밝힌다.
// templates/는 그대로 실행되지 않는 예제다(Bridge.tsx가 없는 ../../videos/bridge_world/Bridge를 import하고,
// world.ts가 동봉되지 않은 Kenney .glb를 staticFile로 읽는다). @remotion/three·three·postprocessing,
// Python 3(numpy·scipy·Pillow), ffmpeg, 내레이션용 TTS는 설치하지 않는다. 외부 API 호출·키 없음,
// 훅 없음(2026-11-26 확인).
export default defineRecipe({
  id: 'skill.animated-shorts', category: 'skill', label: 'Animated Shorts', group: '__motion',
  note: 'item.skill.animated-shorts.note',
  verified: '2026-11-26',
  ...skillsAdd({ source: 'https://github.com/mromidev/claude-animated-shorts', skill: 'cartoon-3d-short' }),
})

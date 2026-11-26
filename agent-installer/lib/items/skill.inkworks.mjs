import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// Moh4696/inkworks-skill(MIT, 커밋 8769b7d). skills/inkworks에 SKILL.md 하나 — 기계·장치의 작동 원리를
// 잉크 외곽선 three.js 부품과 번호 풍선이 달린 제도 도면풍 대화형 3D 페이지로 만들고, 60fps 설명 영상과
// 코드로 합성한 소리까지 뽑는다. three.js는 kit/vendor에 MIT LICENSE와 함께 동봉돼 페이지는 의존성이 없다.
// 정적 서버(kit/serve.py, scripts/new_project.py)에 Python 3, 도구에 playwright(+ playwright install webkit,
// smoke·shoot·record)·ffmpeg(영상)·numpy·scipy(engine_sound)가 필요하고 이 도구는 설치하지 않는다.
// 외부 네트워크는 localhost 서버뿐, API 키 없음. 스킬 폴더 약 1.6MB. 상류 Claude·Codex·Cursor 플러그인
// 매니페스트와 install.sh, examples/ 이미지는 넣지 않는다. 훅 없음(2026-11-26 확인).
export default defineRecipe({
  id: 'skill.inkworks', category: 'skill', label: 'Inkworks', group: '__motion',
  note: 'item.skill.inkworks.note',
  verified: '2026-11-26',
  ...skillsAdd({ source: 'https://github.com/Moh4696/inkworks-skill', skill: 'inkworks' }),
})

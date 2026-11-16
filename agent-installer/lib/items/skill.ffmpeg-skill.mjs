import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// kajisho5/ffmpeg-skill(MIT). 로컬 FFmpeg로 영상·음성을 자르고 이어 붙이고 자막·라우드니스·
// 플랫폼 내보내기까지 한다. 파이썬 표준 라이브러리만 쓰고 클라우드를 쓰지 않는다.
// FFmpeg 6.1+와 Python 3.10+는 사용자가 미리 깔아야 한다. 저장소에는 개발용 스킬
// (.claude/skills)도 있지만 skills CLI는 스킬 하나만 본다(2026-11-16 확인).
export default defineRecipe({
  id: 'skill.ffmpeg-skill', category: 'skill', label: 'FFmpeg Skill', group: '__edit',
  note: 'item.skill.ffmpeg-skill.note',
  verified: '2026-11-16',
  ...skillsAdd({ source: 'https://github.com/kajisho5/ffmpeg-skill', skill: 'ffmpeg-skill' }),
})

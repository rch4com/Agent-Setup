import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// browser-use/video-use(MIT). 대화로 영상을 편집하는 스킬 하나(저장소 루트 SKILL.md, skills --list로
// 확인, 2026-11-18). 스킬 폴더에 helpers/(파이썬 스크립트)·pyproject.toml·nested skills/manim-video가
// 함께 복사된다(858KB). SKILL.md가 helpers 경로를 SKILL.md 위치 기준으로 풀라고 해서 공유 디렉터리에서
// 그대로 동작한다. 실행에는 ffmpeg, Python>=3.10 의존성(uv sync 또는 pip install -e ., 애니메이션은
// manim 선택), ElevenLabs API 키(스킬 폴더의 .env — 복사된 .gitignore가 .env를 무시한다)가 필요하다.
// 이 도구는 그것들을 깔거나 키를 받지 않는다 — note가 알린다.
export default defineRecipe({
  id: 'skill.video-use', category: 'skill', label: 'video-use', group: '__edit',
  note: 'item.skill.video-use.note',
  verified: '2026-11-18',
  ...skillsAdd({ source: 'https://github.com/browser-use/video-use', skill: 'video-use' }),
})

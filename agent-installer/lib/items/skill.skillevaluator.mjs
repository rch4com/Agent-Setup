import { defineRecipe } from '../recipe.mjs'
import { skillsAdd, uvToolApp, withApp } from '../recipe-helpers.mjs'
// NVIDIA/SkillEvaluator(Apache-2.0). 에이전트 스킬을 3단계(정적 검증·보안 스캔, 중복 탐지,
// 스킬 유무로 비교하는 실제 에이전트 평가)로 평가하는 파이썬 프레임워크. 스킬은 skills/skillevaluator
// 하나이고(skills --list로 확인, 2026-11-21) 본문이 skillevaluator CLI를 구동하는 절차라 CLI가
// 전제다 — PATH에 없으면 상류 README대로 uv tool install --python 3.13으로 함께 깐다
// (requires-python >=3.12,<3.15라 uv 기본 파이썬이 범위 밖이면 실패하므로 고정한다).
// 상류에 훅·플러그인 매니페스트는 없다. Tier 1만 기본 설치로 돌고, Tier 3 실평가는 Docker와 LLM
// 공급자 키, 전체 단계는 skillevaluator[all]과 스캐너 설치가 필요하다 — 깔지 않고 note가 알린다.
// 제거는 스킬만 지운다(withApp).
export default defineRecipe({
  id: 'skill.skillevaluator', category: 'skill', label: 'SkillEvaluator', group: '__service',
  note: 'item.skill.skillevaluator.note',
  verified: '2026-11-21',
  ...withApp(
    skillsAdd({ source: 'https://github.com/NVIDIA/SkillEvaluator', skill: 'skillevaluator' }),
    uvToolApp({ bin: 'skillevaluator', pkg: 'skillevaluator', python: '3.13' }),
  ),
})

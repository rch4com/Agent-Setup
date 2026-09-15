import { defineRegistrySkill } from '../catalog.mjs'
// 상류는 루트 SKILL.md(공개 URL이 서빙하는 판)와 skills/officecli/SKILL.md
// (레지스트리가 발견하는 spec 준수 판)를 바이트 동일하게 유지한다(상류
// skill-parity 워크플로). 저장소 루트를 source로 주면 레지스트리가 루트
// SKILL.md를 스킬로 보고 **저장소 전체**(src·assets·워크플로, 94MB·1,208
// 파일)를 .agents/skills/officecli에 복사한다 — 2026-09-15 실측. 그래서
// skills/officecli 하위 경로를 준다: SKILL.md 하나(28K)만 들어온다.
// 잠금 파일의 source는 하위 경로 없이 iOfficeAI/OfficeCLI로 기록되는데,
// 단일 스킬 항목은 잠금이 아니라 이름으로 지우므로 영향이 없다.
//
// 스킬 본문은 officecli 바이너리를 구동하는 지침이라 바이너리가 사실상
// 전제다 — note가 알린다. 같은 폴더의 전문 스킬 10종(officecli-docx·pptx·
// xlsx, pitch-deck, morph-ppt 등)은 넣지 않는다 — 상류가 에이전트에 안내하는
// 공식 경로는 이 하나다(README "For AI Agents").
export default defineRegistrySkill({
  id: 'skill.officecli', label: 'OfficeCLI', group: '__service',
  source: 'https://github.com/iOfficeAI/OfficeCLI/tree/main/skills/officecli',
  skill: 'officecli',
  note: 'item.skill.officecli.note',
  verified: '2026-09-15',
})

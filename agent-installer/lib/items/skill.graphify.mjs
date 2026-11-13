import { rmSync } from 'node:fs'
import { repoPathStrict } from '../context.mjs'
import { defineRecipe } from '../recipe.mjs'
import { claudeAdapterStep, withApp } from '../recipe-helpers.mjs'
import { SHARED } from '../recipe.mjs'
import { SHARED_SKILLS } from '../skills-registry.mjs'
import { GRAPHIFY_APP } from './mcp.graphify.mjs'
// /graphify 스킬. mcp.graphify를 고르면 bundles로 함께 골라진다. MCP 등록과는 별개다 — 상류 README "CLI skills or
// MCP instructions?": graphify install은 MCP 연결을 만들지 않고, MCP는 스킬을 주지
// 않는다. 상류에 레지스트리용 SKILL.md가 없어(graphify/skill.md 등 플랫폼별 원본)
// npx skills가 아니라 상류 설치기를 쓴다.
//
// --platform agents가 .agents/skills/graphify/SKILL.md(+references/)를 쓴다 —
// 공유 디렉터리라 Codex·OpenCode·Copilot·VS Code·Antigravity가 그대로 읽고,
// Claude Code는 어댑터(.claude/skills Junction)로 본다. 전역 판은 Claude 경로
// (~/.claude/skills)를 따로 깔아야 하고 그 제거 문법이 문서에 없어 넣지 않는다.
// (2026-11-13 확인: Graphify-Labs/graphify v8 README, graphifyy 0.9.107.)
const DIR = `${SHARED_SKILLS}/graphify`

export default defineRecipe({
  id: 'skill.graphify', category: 'skill', label: 'Graphify', group: '__context',
  note: 'item.skill.graphify.note',
  verified: '2026-11-13',
  ...withApp({
    recipes: {
      [SHARED]: {
        project: {
          install: [['graphify', 'install', '--project', '--platform', 'agents'], claudeAdapterStep],
          uninstall: [
            { argv: ['graphify', 'uninstall', '--project', '--platform', 'agents'], tolerateFail: true },
            { describe: `remove leftover ${DIR}`, fn: ({ root }) => rmSync(repoPathStrict(root, DIR), { recursive: true, force: true }) },
          ],
        },
      },
    },
    detect: { [SHARED]: (p) => p.skill('graphify') },
  }, GRAPHIFY_APP),
})

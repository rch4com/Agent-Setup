import { defineGlobalPlugin } from '../global-plugin.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'

// superpowers를 프로젝트 스코프로 배선할 길이 없는 하니스에 상류의 하니스별
// 전역 설치("install separately for each one")를 대신 해 주는 항목. 공통
// 기구는 global-plugin.mjs에 있고, 여기는 상류 좌표와 사유만 든다.
//
// 하니스별 근거(2026-08-15, v6.3.0):
//   codex   — 이 머신에서 marketplace add + plugin add를 실측. 기록은
//             $CODEX_HOME/config.toml의 [plugins."superpowers@…"].
//   copilot — 이 머신에서 설치·목록·제거를 실측(~/.copilot/config.json).
//   gemini  — 공식 extensions 기구. 로컬 CLI가 없어 문서 근거다.
//   opencode— 상류 .opencode/INSTALL.md가 전역 opencode.json의 plugin 배열에
//             아래 항목 한 줄을 더하라고 안내한다.
//
// grok은 상류 명령(grok plugin install superpowers@xai-official --trust)이
// 있지만 감지·제거 경로를 실측할 CLI가 없어 아직 배선하지 않고, kimi는 설치가
// 대화형 /plugins뿐이라 헤드리스 경로가 없다. claude는 프로젝트 스코프 항목
// (plugin.superpowers)의 자리다.
//
// skill.superpowers(공유 .agents/skills)와 배타로 묶지 않는다 — 저쪽은 이
// 저장소에만, 이쪽은 머신 전체에 작용해 평면이 다르고, "claude는 프로젝트
// 플러그인 + 나머지는 전역" 같은 조합이 정당하다. 겹치는 하니스가 같은 스킬을
// 두 곳에서 본다는 것은 note에 적어 둔다.
const SUPPORTS = ['codex', 'gemini', 'opencode', 'copilot']

const CONFIG = {
  id: 'global.superpowers', label: 'superpowers (global)', group: '__flow',
  note: 'item.global.superpowers.note',
  pluginName: 'superpowers',
  marketplaceRepo: 'obra/superpowers-marketplace',
  installId: 'superpowers@superpowers-marketplace',
  gemini: 'https://github.com/obra/superpowers',
  opencode: 'superpowers@git+https://github.com/obra/superpowers.git',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => !SUPPORTS.includes(c)).map((c) => [
      c,
      c === 'claude' ? msg('item.unsupported.superpowersGlobalClaude')
      : c === 'grok' ? msg('item.unsupported.superpowersGlobalGrok')
      : c === 'kimi' ? msg('item.unsupported.superpowersGlobalKimi')
      : msg('item.unsupported.upstreamNone'),
    ]),
  ),
}

// 테스트가 홈·환경·PATH 탐지를 갈아끼울 수 있게 공장으로 노출한다.
export function createItem(deps = {}) {
  return defineGlobalPlugin(CONFIG, deps)
}

export default createItem()

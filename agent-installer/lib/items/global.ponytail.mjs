import { defineGlobalPlugin } from '../global-plugin.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'

// Ponytail의 하니스별 전역 설치 판. 공통 기구는 global-plugin.mjs에 있다.
//
// 하니스별 근거(2026-08-15 상류 README 재검증):
//   codex   — `codex plugin marketplace add DietrichGebert/ponytail` +
//             `codex plugin add ponytail@ponytail`. 상류는 설치 후 codex에서
//             /hooks로 라이프사이클 훅 등록을 확인하고 새 스레드를 시작하라는
//             대화형 후속 단계를 안내한다 — 명령으로 대신할 수 없어 note에
//             적는다. 제거는 `codex plugin remove <id>`.
//   copilot — `copilot plugin marketplace add` + `copilot plugin install
//             ponytail@ponytail`. 상류 README에 제거 명령은 없지만
//             `copilot plugin uninstall <이름>`은 copilot CLI 자체의 범용
//             명령이다(--help 실측).
//   gemini  — `gemini extensions install https://github.com/DietrichGebert/ponytail`.
//
// opencode는 프로젝트 항목(plugin.ponytail)이 opencode.jsonc의 plugin 배열로
// 이미 배선한다 — 전역 판에서 겹치면 같은 플러그인이 두 번 등록된다. claude도
// 같은 이유로 프로젝트 항목의 자리다. grok은 상류 명령이 있으나 감지·제거
// 경로를 실측할 CLI가 없어 superpowers 전역 판과 같은 기준으로 제외한다.
// kiro·vscode는 상류가 룰 파일 수동 배치만 안내하고, kilo·kimi는 경로가 없다.
//
// 상류는 플러그인 제거 전에 node scripts/uninstall.js로 ~/.config/ponytail
// 설정과 statusLine 항목을 정리하라고 안내한다 — 하니스마다 스크립트 위치가
// 달라 자동화하지 않고 note로 알린다. 이 항목은 플러그인만 제거한다.
const SUPPORTS = ['codex', 'gemini', 'copilot']

const CONFIG = {
  id: 'global.ponytail', label: 'Ponytail (global)', group: '__token',
  note: 'item.global.ponytail.note',
  pluginName: 'ponytail',
  marketplaceRepo: 'DietrichGebert/ponytail',
  installId: 'ponytail@ponytail',
  gemini: 'https://github.com/DietrichGebert/ponytail',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => !SUPPORTS.includes(c)).map((c) => [
      c,
      ['claude', 'opencode'].includes(c) ? msg('item.unsupported.globalProjectItem', { item: 'Ponytail' })
      : c === 'grok' ? msg('item.unsupported.ponytailGlobalGrok')
      : ['kiro', 'vscode'].includes(c) ? msg('item.unsupported.ponytailRules')
      : msg('item.unsupported.upstreamNone'),
    ]),
  ),
}

export function createItem(deps = {}) {
  return defineGlobalPlugin(CONFIG, deps)
}

export default createItem()

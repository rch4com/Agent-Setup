import { CLI_IDS } from '../clis.mjs'
import { isPluginEnabled, enablePlugin, disablePlugin } from '../claude-plugins.mjs'
import { repoPath, repoPathStrict } from '../context.mjs'
import { readJson, setKey, removeKey } from '../jsonfile.mjs'
import { msg, LocalizedError } from '../i18n/index.mjs'

// 상류 안내는 `--scope user`지만 이 저장소의 항목은 전부 프로젝트 스코프다.
// 같은 규칙 묶음이 두 경로로 들어간다 — Claude Code는 플러그인 CLI(실패하면
// .claude/settings.json 기록), OpenCode는 프로젝트 설정의 plugin 배열.
// 두 경로 모두 저장소 안에만 쓴다.
const INSTALL_ID = 'ponytail@ponytail'
const MARKETPLACE = { name: 'ponytail', repo: 'DietrichGebert/ponytail' }
const OPENCODE_FILE = 'opencode.jsonc'
const OPENCODE_ENTRY = '@dietrichgebert/ponytail'
const SUPPORTS = ['claude', 'opencode']

// plugin 키가 배열이 아니면 손대지 않는다 — 통째로 덮어쓰면 사용자가 적어 둔
// 설정이 조용히 사라진다. 없는 것(undefined)과 다른 타입을 구분해서 돌려준다.
function opencodePlugins(root) {
  const value = readJson(repoPath(root, OPENCODE_FILE))?.plugin
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  return value
}

function opencodeListOrThrow(root) {
  const list = opencodePlugins(root)
  if (list === null) throw new LocalizedError('error.ponytailOpencodePlugin', { file: OPENCODE_FILE })
  return list
}

function hasOpencode(root) {
  return (opencodePlugins(root) ?? []).includes(OPENCODE_ENTRY)
}

export default {
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail', scope: 'project',
  group: '__token',
  supports: SUPPORTS,
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => !SUPPORTS.includes(c)).map((c) => [
      c,
      // codex·copilot·grok·gemini는 상류에 설치 경로가 있지만 전부 사용자
      // 스코프다. grok은 `grok plugin install DietrichGebert/ponytail --trust`로
      // 플러그인 기구가 엄연히 있다 — "기구가 없다" 쪽에 두면 거짓이다
      // (2026-08-15 재측정). 나머지는 상류의 규칙 파일을 손으로 옮겨야 한다.
      ['codex', 'copilot', 'gemini', 'grok'].includes(c)
        ? msg('item.unsupported.ponytailUser')
        : msg('item.unsupported.ponytailRules'),
    ]),
  ),
  note: 'item.plugin.ponytail.note',

  async detect({ root }) {
    const present = []
    if (isPluginEnabled(root, [INSTALL_ID])) present.push('claude')
    if (hasOpencode(root)) present.push('opencode')
    if (present.length === 0) return { status: 'absent' }
    if (present.length === SUPPORTS.length) return { status: 'installed' }
    return {
      status: 'partial',
      detail: msg('item.plugin.partial', {
        present: present.join(', '),
        missing: SUPPORTS.filter((c) => !present.includes(c)).join(', '),
      }),
    }
  },

  async install({ root, dryRun, exec, log = () => {}, t }) {
    let deferred = false
    if (!isPluginEnabled(root, [INSTALL_ID])) {
      await exec('claude', ['plugin', 'marketplace', 'add', MARKETPLACE.repo], { cwd: root })
      const r = await exec('claude', ['plugin', 'install', INSTALL_ID, '--scope', 'project'], { cwd: root })
      if (!r.ok) {
        if (!dryRun) enablePlugin(root, INSTALL_ID, MARKETPLACE)
        deferred = true
      }
    }
    if (!hasOpencode(root)) {
      const list = opencodeListOrThrow(root)
      if (dryRun) log(t('log.plugin.add', { cli: 'OpenCode', name: OPENCODE_ENTRY }))
      // 파일이 없거나 plugin 키가 없으면 배열째 만들고, 있으면 끝에 덧붙인다.
      else if (list.length === 0) setKey(repoPathStrict(root, OPENCODE_FILE), ['plugin'], [OPENCODE_ENTRY])
      else setKey(repoPathStrict(root, OPENCODE_FILE), ['plugin', list.length], OPENCODE_ENTRY)
    }
    if (deferred) return { fallback: true, message: msg('item.plugin.deferred') }
  },

  async uninstall({ root, dryRun, exec, log = () => {}, t }) {
    if (isPluginEnabled(root, [INSTALL_ID])) {
      const r = await exec('claude', ['plugin', 'uninstall', INSTALL_ID], { cwd: root })
      if (!r.ok && !dryRun) disablePlugin(root, [INSTALL_ID])
    }
    if (!hasOpencode(root)) return
    if (dryRun) {
      log(t('log.plugin.remove', { cli: 'OpenCode', name: OPENCODE_ENTRY }))
      return
    }
    const kept = opencodeListOrThrow(root).filter((p) => p !== OPENCODE_ENTRY)
    const file = repoPathStrict(root, OPENCODE_FILE)
    // 우리가 넣은 항목만 빼고 비면 키째 지운다 — 빈 배열을 남기면 우리가
    // 만든 흔적이 설정에 계속 남는다.
    if (kept.length === 0) removeKey(file, ['plugin'])
    else setKey(file, ['plugin'], kept)
  },
}

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { parse as parseToml } from 'smol-toml'
import { CLI_IDS, CLIS } from '../clis.mjs'
import { readJson, setKey, removeKey } from '../jsonfile.mjs'
import { msg, LocalizedError } from '../i18n/index.mjs'

// 이 저장소의 유일한 사용자 전역(scope: 'user') 항목이다. superpowers를
// 프로젝트 스코프로 배선할 길이 없는 하니스는 상류가 "install separately for
// each one"이라고 못 박은 하니스별 전역 설치뿐이라, 그 폴백을 요청받아 여기에
// 담는다. 전역 파일을 만지므로 repoPath 계열 가드를 일부러 안 쓴다 — 저장소
// 이탈이 목적인 항목이다.
//
// 하니스별 근거(2026-08-15, v6.3.0):
//   codex   — 이 머신에서 marketplace add(obra/superpowers-marketplace)와
//             plugin add를 실측. 기록은 $CODEX_HOME/config.toml의
//             [plugins."superpowers@…"] 섹션이고, CODEX_HOME 재지정을 실제로
//             쓰는 환경(Orca)이 있어 반드시 환경변수를 따라간다.
//   copilot — 이 머신에서 설치·목록을 실측. 기록은 ~/.copilot/config.json의
//             installedPlugins[]. 다른 copilot 세션이 떠 있으면 install·
//             uninstall이 os error 5로 한 번 실패했다가 재시도에 성공하는
//             것까지 실측 — 그래서 copilot 명령만 한 번 재시도한다.
//   gemini  — 공식 extensions 기구(gemini extensions install/uninstall,
//             배치는 ~/.gemini/extensions/<이름>). 로컬 CLI가 없어 문서 근거다.
//   opencode— 상류 .opencode/INSTALL.md가 전역 opencode.json의 plugin 배열에
//             "superpowers@git+…" 한 줄을 더하라고 안내한다. 파일 편집이라
//             CLI 실행 없이 배선되고, 전역 경로는 XDG_CONFIG_HOME을 따른다.
//
// grok은 상류 명령(grok plugin install superpowers@xai-official --trust)이
// 있지만 감지·제거 경로를 실측할 CLI가 없어 아직 배선하지 않고, kimi는 설치가
// 대화형 /plugins뿐이라 헤드리스 경로가 없다. claude는 프로젝트 스코프 항목
// (plugin.superpowers)의 자리다.
//
// skill.superpowers(공유 .agents/skills)와 배타로 묶지 않는다 — 저쪽은 이
// 저장소에만, 이쪽은 머신 전체에 작용해 평면이 다르고, "claude는 프로젝트
// 플러그인 + 나머지는 전역" 같은 조합이 정당하다. 다만 함께 켜면 겹치는
// 하니스는 같은 스킬을 두 곳에서 본다 — note에 적어 둔다.
const SUPPORTS = ['codex', 'gemini', 'opencode', 'copilot']
const MARKETPLACE_REPO = 'obra/superpowers-marketplace'
const INSTALL_ID = 'superpowers@superpowers-marketplace'
const GEMINI_URL = 'https://github.com/obra/superpowers'
const OPENCODE_ENTRY = 'superpowers@git+https://github.com/obra/superpowers.git'

// 실행은 cmd 셸을 거치므로(catalog.mjs makeExec) win32에서는 PATHEXT 확장자가
// 있어야 실제로 부를 수 있다 — copilot.ps1만 있는 PATH는 "없음"이 맞다.
function defaultHasBinary(name, env = process.env) {
  const dirs = (env.PATH ?? '').split(delimiter).filter(Boolean)
  const exts = process.platform === 'win32'
    ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : ['']
  return dirs.some((dir) => exts.some((ext) => existsSync(join(dir, name + ext))))
}

// superpowers@openai-curated처럼 다른 마켓플레이스로 설치된 판도 잡아야
// 하므로(실측: 이런 머신이 실제로 있다) 이름이 아니라 접두사로 고른다.
// 제거도 여기서 찾은 id를 그대로 쓴다 — 우리가 설치한 판만이 아니라 감지가
// "있다"고 말한 판을 지워야 상태가 맞아떨어진다.
function codexPluginIds(file) {
  if (!existsSync(file)) return []
  try {
    const data = parseToml(readFileSync(file, 'utf8'))
    return Object.keys(data.plugins ?? {}).filter((id) => id.startsWith('superpowers@'))
  } catch {
    // 깨진 config.toml은 미설치로 둔다 — 설치를 시도하면 codex가 스스로
    // 진단하고, "설치됨"으로 오판해 제거를 그리로 보내는 것보다 낫다.
    return []
  }
}

function copilotInstalled(file) {
  const list = readJson(file)?.installedPlugins
  return Array.isArray(list) && list.some((p) => p?.name === 'superpowers')
}

// ponytail과 같은 규칙: plugin 키가 배열이 아니면 손대지 않는다.
function opencodePlugins(file) {
  const value = readJson(file)?.plugin
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  return value
}

const isOurEntry = (p) => String(p).startsWith('superpowers@')

// 테스트가 홈·환경·PATH 탐지를 갈아끼울 수 있게 공장으로 노출한다.
// 기본 인스턴스는 실행 시점의 process.env를 그대로 본다.
export function createItem({ home = null, env = process.env, hasBinary = defaultHasBinary } = {}) {
  const files = () => {
    const base = home ?? homedir()
    return {
      codex: join(env.CODEX_HOME || join(base, '.codex'), 'config.toml'),
      copilot: join(base, '.copilot', 'config.json'),
      gemini: join(base, '.gemini', 'extensions', 'superpowers'),
      opencode: join(env.XDG_CONFIG_HOME || join(base, '.config'), 'opencode', 'opencode.json'),
    }
  }

  const wired = {
    codex: (f) => codexPluginIds(f.codex).length > 0,
    copilot: (f) => copilotInstalled(f.copilot),
    gemini: (f) => existsSync(f.gemini),
    opencode: (f) => (opencodePlugins(f.opencode) ?? []).some(isOurEntry),
  }

  return {
    id: 'global.superpowers', category: 'plugin', label: 'superpowers (global)', scope: 'user',
    group: '__flow',
    supports: [...SUPPORTS],
    unsupported: Object.fromEntries(
      CLI_IDS.filter((c) => !SUPPORTS.includes(c)).map((c) => [
        c,
        c === 'claude' ? msg('item.unsupported.superpowersGlobalClaude')
        : c === 'grok' ? msg('item.unsupported.superpowersGlobalGrok')
        : c === 'kimi' ? msg('item.unsupported.superpowersGlobalKimi')
        : msg('item.unsupported.upstreamNone'),
      ]),
    ),
    note: 'item.global.superpowers.note',

    // 상태는 "이 머신에 있는 하니스" 기준이다. CLI가 없는 하니스까지 누락으로
    // 세면 gemini 없는 머신은 영원히 partial이라 apply가 매번 헛돈다.
    async detect() {
      const f = files()
      const present = SUPPORTS.filter((c) => wired[c](f))
      const machine = SUPPORTS.filter((c) => hasBinary(c))
      const noCli = SUPPORTS.filter((c) => !machine.includes(c))
      const missing = machine.filter((c) => !present.includes(c))
      const detail = noCli.length > 0 ? msg('item.global.noCli', { list: noCli.join(', ') }) : undefined
      if (present.length === 0) return { status: 'absent', detail }
      if (missing.length === 0) return { status: 'installed', detail }
      return {
        status: 'partial',
        detail: msg('item.plugin.partial', { present: present.join(', '), missing: missing.join(', ') }),
      }
    },

    async install({ dryRun, exec, log = () => {}, t }) {
      const f = files()
      // opencode 설정이 손댈 수 없는 꼴이면 아무것도 만지기 전에 멈춘다 —
      // 절반만 설치된 채 실패하는 것보다 통째로 거절이 낫다.
      const needsOpencode = !wired.opencode(f) && hasBinary('opencode')
      if (needsOpencode && !dryRun && opencodePlugins(f.opencode) === null) {
        throw new LocalizedError('error.globalOpencodePlugin', { file: f.opencode })
      }
      const skipped = []
      const failures = []
      const fail = (cli, output) => failures.push(`${cli}: ${String(output).trim().split('\n')[0]}`)
      for (const cli of SUPPORTS) {
        if (wired[cli](f)) continue
        if (!hasBinary(cli)) {
          skipped.push(cli)
          continue
        }
        if (cli === 'codex') {
          // 마켓 등록은 이미 있어도 해가 없다 — 성패는 add가 판정한다.
          await exec('codex', ['plugin', 'marketplace', 'add', MARKETPLACE_REPO])
          const r = await exec('codex', ['plugin', 'add', INSTALL_ID])
          if (!r.ok) fail(cli, r.output)
        } else if (cli === 'copilot') {
          await exec('copilot', ['plugin', 'marketplace', 'add', MARKETPLACE_REPO])
          let r = await exec('copilot', ['plugin', 'install', INSTALL_ID])
          if (!r.ok) r = await exec('copilot', ['plugin', 'install', INSTALL_ID])
          if (!r.ok) fail(cli, r.output)
        } else if (cli === 'gemini') {
          const r = await exec('gemini', ['extensions', 'install', GEMINI_URL])
          if (!r.ok) fail(cli, r.output)
        } else {
          if (dryRun) {
            log(t('log.plugin.add', { cli: CLIS.opencode.label, name: OPENCODE_ENTRY }))
            continue
          }
          const list = opencodePlugins(f.opencode) ?? []
          if (list.length === 0) setKey(f.opencode, ['plugin'], [OPENCODE_ENTRY])
          else setKey(f.opencode, ['plugin', list.length], OPENCODE_ENTRY)
        }
      }
      if (failures.length > 0) throw new LocalizedError('error.globalExec', { detail: failures.join(' / ') })
      if (skipped.length > 0) return { message: msg('item.global.skipped', { list: skipped.join(', ') }) }
    },

    async uninstall({ dryRun, exec, log = () => {}, t }) {
      const f = files()
      const skipped = []
      const failures = []
      const fail = (cli, output) => failures.push(`${cli}: ${String(output).trim().split('\n')[0]}`)
      for (const cli of SUPPORTS) {
        if (!wired[cli](f)) continue
        if (cli === 'opencode') {
          if (dryRun) {
            log(t('log.plugin.remove', { cli: CLIS.opencode.label, name: OPENCODE_ENTRY }))
            continue
          }
          const kept = (opencodePlugins(f.opencode) ?? []).filter((p) => !isOurEntry(p))
          // 우리 항목만 빼고 비면 키째 지운다 — 빈 배열은 우리가 남긴 흔적이다.
          if (kept.length === 0) removeKey(f.opencode, ['plugin'])
          else setKey(f.opencode, ['plugin'], kept)
          continue
        }
        if (!hasBinary(cli)) {
          skipped.push(cli)
          continue
        }
        if (cli === 'codex') {
          for (const id of codexPluginIds(f.codex)) {
            const r = await exec('codex', ['plugin', 'remove', id])
            if (!r.ok) fail(cli, r.output)
          }
          // 마켓플레이스 등록은 남긴다 — 우리가 등록했다는 보장이 없고,
          // 같은 마켓의 다른 플러그인이 쓰고 있을 수 있다.
        } else if (cli === 'copilot') {
          let r = await exec('copilot', ['plugin', 'uninstall', 'superpowers'])
          if (!r.ok) r = await exec('copilot', ['plugin', 'uninstall', 'superpowers'])
          if (!r.ok) fail(cli, r.output)
        } else {
          const r = await exec('gemini', ['extensions', 'uninstall', 'superpowers'])
          if (!r.ok) fail(cli, r.output)
        }
      }
      if (failures.length > 0) throw new LocalizedError('error.globalExec', { detail: failures.join(' / ') })
      if (skipped.length > 0) return { message: msg('item.global.skipped', { list: skipped.join(', ') }) }
    },
  }
}

export default createItem()

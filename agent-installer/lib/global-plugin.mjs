// 사용자 전역(scope: 'user') 플러그인 항목의 공통 기구. 상류가 하니스별 전역
// 설치만 지원하는 도구(superpowers, ponytail)가 공유한다 — 항목 파일
// (lib/items/global.*.mjs)은 상류별 좌표와 미배선 사유만 든다.
//
// 전역 파일을 만지므로 repoPath 계열 가드를 일부러 안 쓴다 — 저장소 이탈이
// 목적인 기구다. 항목 파일에 두지 않는 이유는 gitmessage.mjs와 같다:
// loadItems가 items/의 모든 .mjs를 항목으로 읽는다.
//
// 하니스별 기록 위치(2026-08-15 실측, 상세는 global.superpowers.mjs):
//   codex    $CODEX_HOME/config.toml의 [plugins."<이름>@…"] — CODEX_HOME
//            재지정을 실제로 쓰는 환경(Orca)이 있어 환경변수를 따라간다.
//   copilot  ~/.copilot/config.json의 installedPlugins[] (주석 있는 JSONC).
//   gemini   ~/.gemini/extensions/<이름>/ (공식 extensions 문서).
//   opencode 전역 opencode.json의 plugin 배열 (XDG_CONFIG_HOME 존중).
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { parse as parseToml } from 'smol-toml'
import { CLIS } from './clis.mjs'
import { readJson, setKey, removeKey } from './jsonfile.mjs'
import { msg, LocalizedError } from './i18n/index.mjs'

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
// 제거도 여기서 찾은 id를 그대로 쓴다 — 감지가 "있다"고 말한 판을 지워야
// 상태가 맞아떨어진다.
function codexPluginIds(file, pluginName) {
  if (!existsSync(file)) return []
  try {
    const data = parseToml(readFileSync(file, 'utf8'))
    return Object.keys(data.plugins ?? {}).filter((id) => id.startsWith(`${pluginName}@`))
  } catch {
    // 깨진 config.toml은 미설치로 둔다 — 설치를 시도하면 codex가 스스로
    // 진단하고, "설치됨"으로 오판해 제거를 그리로 보내는 것보다 낫다.
    return []
  }
}

function copilotInstalled(file, pluginName) {
  const list = readJson(file)?.installedPlugins
  return Array.isArray(list) && list.some((p) => p?.name === pluginName)
}

// ponytail(items/plugin.ponytail.mjs)과 같은 규칙: plugin 키가 배열이 아니면
// 손대지 않는다.
function opencodePlugins(file) {
  const value = readJson(file)?.plugin
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  return value
}

// config:
//   pluginName      감지·제거가 쓰는 상류 이름 (codex 접두사, copilot name,
//                   gemini 확장 디렉터리 이름)
//   marketplaceRepo codex·copilot 마켓플레이스 (owner/repo)
//   installId       마켓플레이스 설치 id (<이름>@<마켓>)
//   gemini          gemini extensions install에 줄 git URL, 없으면 null
//   opencode        전역 opencode.json plugin 배열에 넣을 항목, 없으면 null
// supports는 어댑터 유무로 정해진다 — codex·copilot은 항상, gemini·opencode는
// 좌표가 있을 때만.
export function defineGlobalPlugin(
  { id, label, group, note, exclusive = null, unsupported = {}, pluginName, marketplaceRepo, installId, gemini = null, opencode = null },
  { home = null, env = process.env, hasBinary = defaultHasBinary } = {},
) {
  const supports = ['codex', ...(gemini ? ['gemini'] : []), ...(opencode ? ['opencode'] : []), 'copilot']

  const files = () => {
    const base = home ?? homedir()
    return {
      codex: join(env.CODEX_HOME || join(base, '.codex'), 'config.toml'),
      copilot: join(base, '.copilot', 'config.json'),
      gemini: join(base, '.gemini', 'extensions', pluginName),
      opencode: join(env.XDG_CONFIG_HOME || join(base, '.config'), 'opencode', 'opencode.json'),
    }
  }

  const isOurEntry = (p) => String(p).startsWith(`${pluginName}@`)
  const wired = {
    codex: (f) => codexPluginIds(f.codex, pluginName).length > 0,
    copilot: (f) => copilotInstalled(f.copilot, pluginName),
    gemini: (f) => existsSync(f.gemini),
    opencode: (f) => (opencodePlugins(f.opencode) ?? []).some(isOurEntry),
  }

  return {
    id, category: 'plugin', label, scope: 'user', group, exclusive,
    supports: [...supports],
    unsupported,
    note,

    // 상태는 "이 머신에 있는 하니스" 기준이다. CLI가 없는 하니스까지 누락으로
    // 세면 gemini 없는 머신은 영원히 partial이라 apply가 매번 헛돈다.
    async detect() {
      const f = files()
      const present = supports.filter((c) => wired[c](f))
      const machine = supports.filter((c) => hasBinary(c))
      const noCli = supports.filter((c) => !machine.includes(c))
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
      const needsOpencode = opencode && !wired.opencode(f) && hasBinary('opencode')
      if (needsOpencode && !dryRun && opencodePlugins(f.opencode) === null) {
        throw new LocalizedError('error.globalOpencodePlugin', { file: f.opencode, entry: opencode })
      }
      const skipped = []
      const failures = []
      const fail = (cli, output) => failures.push(`${cli}: ${String(output).trim().split('\n')[0]}`)
      for (const cli of supports) {
        if (wired[cli](f)) continue
        if (!hasBinary(cli)) {
          skipped.push(cli)
          continue
        }
        if (cli === 'codex') {
          // 마켓 등록은 이미 있어도 해가 없다 — 성패는 add가 판정한다.
          await exec('codex', ['plugin', 'marketplace', 'add', marketplaceRepo])
          const r = await exec('codex', ['plugin', 'add', installId])
          if (!r.ok) fail(cli, r.output)
        } else if (cli === 'copilot') {
          await exec('copilot', ['plugin', 'marketplace', 'add', marketplaceRepo])
          // 실측(2026-08-15): 다른 copilot 세션이 떠 있으면 os error 5로 한 번
          // 실패하고 재시도에 성공한다. 한 번만 다시 시도한다.
          let r = await exec('copilot', ['plugin', 'install', installId])
          if (!r.ok) r = await exec('copilot', ['plugin', 'install', installId])
          if (!r.ok) fail(cli, r.output)
        } else if (cli === 'gemini') {
          const r = await exec('gemini', ['extensions', 'install', gemini])
          if (!r.ok) fail(cli, r.output)
        } else {
          if (dryRun) {
            log(t('log.plugin.add', { cli: CLIS.opencode.label, name: opencode }))
            continue
          }
          const list = opencodePlugins(f.opencode) ?? []
          if (list.length === 0) setKey(f.opencode, ['plugin'], [opencode])
          else setKey(f.opencode, ['plugin', list.length], opencode)
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
      for (const cli of supports) {
        if (!wired[cli](f)) continue
        if (cli === 'opencode') {
          if (dryRun) {
            log(t('log.plugin.remove', { cli: CLIS.opencode.label, name: opencode }))
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
          for (const pid of codexPluginIds(f.codex, pluginName)) {
            const r = await exec('codex', ['plugin', 'remove', pid])
            if (!r.ok) fail(cli, r.output)
          }
          // 마켓플레이스 등록은 남긴다 — 우리가 등록했다는 보장이 없고,
          // 같은 마켓의 다른 플러그인이 쓰고 있을 수 있다.
        } else if (cli === 'copilot') {
          let r = await exec('copilot', ['plugin', 'uninstall', pluginName])
          if (!r.ok) r = await exec('copilot', ['plugin', 'uninstall', pluginName])
          if (!r.ok) fail(cli, r.output)
        } else {
          const r = await exec('gemini', ['extensions', 'uninstall', pluginName])
          if (!r.ok) fail(cli, r.output)
        }
      }
      if (failures.length > 0) throw new LocalizedError('error.globalExec', { detail: failures.join(' / ') })
      if (skipped.length > 0) return { message: msg('item.global.skipped', { list: skipped.join(', ') }) }
    },
  }
}

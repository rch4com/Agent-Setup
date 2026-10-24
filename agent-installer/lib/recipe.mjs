// 레시피 = CLI·범위별 설치 명령 목록. 항목 파일은 데이터만 적고, 이 모듈이
// 그것을 엔진·TUI가 아는 항목 모양으로 바꾼다. 실행(install)과 출력(--print)이
// 같은 steps()에서 명령을 얻으므로 둘이 어긋날 수 없다.
import { join } from 'node:path'
import { CLIS, CLI_IDS as RECIPE_CLIS } from './clis.mjs'
import { LocalizedError, msg } from './i18n/index.mjs'

export const SCOPES = ['project', 'user']
// 한 단계 묶음이 네 CLI를 한꺼번에 덮는 자리(.agents/skills).
export const SHARED = 'shared'
// 실패 보고에 싣는 출력 줄 수. 설치 로그 전체는 화면을 덮는다.
const TAIL_LINES = 5

export function normalizeStep(step, cli) {
  if (Array.isArray(step)) return { cli, argv: step, cwd: null, tolerateFail: false, undo: null, timeout: null }
  if (step && Array.isArray(step.argv)) {
    return { cli, argv: step.argv, cwd: step.cwd ?? null, tolerateFail: Boolean(step.tolerateFail), undo: step.undo ?? null, timeout: step.timeout ?? null }
  }
  if (step && typeof step.fn === 'function' && step.describe) return { cli, fn: step.fn, describe: String(step.describe) }
  return null
}

function assertRecipe(def) {
  const bad = (why) => { throw new LocalizedError('error.recipeInvalid', { id: def?.id ?? '?', why }) }
  for (const field of ['id', 'category', 'label']) if (!def?.[field]) bad(`missing ${field}`)
  const entries = Object.entries(def.recipes ?? {})
  if (entries.length === 0) bad('no recipes')
  if (def.recipes[SHARED] && entries.length > 1) bad('shared cannot be combined with per-CLI recipes')
  for (const [cli, byScope] of entries) {
    if (cli !== SHARED && !RECIPE_CLIS.includes(cli)) bad(`unknown CLI ${cli}`)
    for (const [scope, recipe] of Object.entries(byScope)) {
      if (!SCOPES.includes(scope)) bad(`unknown scope ${scope}`)
      for (const action of ['install', 'uninstall']) {
        if (!Array.isArray(recipe?.[action])) bad(`${cli}.${scope}.${action} is not a list`)
        for (const raw of recipe[action]) {
          const step = normalizeStep(raw, cli)
          if (!step || (step.argv && (step.argv.length === 0 || !step.argv.every((a) => typeof a === 'string')))) {
            bad(`${cli}.${scope}.${action} has a bad step`)
          }
        }
      }
    }
    if (typeof def.detect?.[cli] !== 'function') bad(`detect.${cli} missing`)
  }
}

export function defineRecipe(def) {
  assertRecipe(def)
  return { ...def, kind: 'recipe' }
}

const reasonOf = (r) => (typeof r === 'string' ? msg(r) : r)

export function bindScope(def, scope) {
  const shared = def.recipes[SHARED]
  if (shared && !shared[scope]) return null
  const supports = shared ? [...RECIPE_CLIS] : RECIPE_CLIS.filter((c) => def.recipes[c]?.[scope])
  if (supports.length === 0) return null

  // 다른 범위엔 레시피가 있으면 "범위를 바꾸면 된다"가 사유다. 어느 범위에도
  // 없을 때만 항목이 사유를 직접 대야 한다 — 빠뜨리면 로드 오류로 막는다.
  const other = scope === 'project' ? 'user' : 'project'
  const unsupported = {}
  for (const cli of RECIPE_CLIS) {
    if (supports.includes(cli)) continue
    if (def.recipes[cli]?.[other]) unsupported[cli] = msg(`item.unsupported.${other}Only`)
    else if (def.reasons?.[cli]) unsupported[cli] = reasonOf(def.reasons[cli])
    else throw new LocalizedError('error.itemReasonMissing', { id: def.id, cli })
  }

  const recipeOf = (cli) => def.recipes[cli][scope]

  return {
    id: def.id, category: def.category, label: def.label,
    group: def.group ?? null, exclusive: def.exclusive ?? null, note: def.note ?? null,
    verified: def.verified ?? null, hooks: Boolean(def.hooks), postInstall: def.postInstall ?? null,
    scope, supports, unsupported,

    async detect({ probe }) {
      const reach = supports.filter((c) => probe.has(c))
      // 공유 스킬은 CLI가 아니라 디렉터리에 깔린다 — PATH와 무관하다.
      const excluded = shared ? [] : supports.filter((c) => !reach.includes(c))
      const targets = shared ? [SHARED] : reach
      const present = []
      const failed = []
      for (const cli of targets) {
        try {
          if (await def.detect[cli](probe)) present.push(cli)
        } catch {
          // 목록 명령 실패(로그인 만료 등)를 "없음"으로 읽으면 깔린 것을 또 깐다.
          failed.push(cli)
        }
      }
      const live = targets.filter((c) => !failed.includes(c))
      const status = present.length === 0 ? 'absent' : present.length === live.length ? 'installed' : 'partial'
      let detail = null
      if (failed.length > 0) detail = msg('item.probeFailed', { list: failed.join(', ') })
      else if (status === 'partial') {
        detail = msg('item.plugin.partial', { present: present.join(', '), missing: live.filter((c) => !present.includes(c)).join(', ') })
      } else if (targets.length === 0) detail = msg('item.global.noCli', { list: excluded.join(', ') })
      return { status, detail, excluded, present, failed, targets, reach }
    },

    steps(action, state = {}) {
      const present = state.present ?? []
      const failed = state.failed ?? []
      const targets = state.targets ?? (shared ? [SHARED] : supports)
      const removing = action === 'uninstall'
      const clis = removing
        ? targets.filter((c) => present.includes(c))
        : targets.filter((c) => !present.includes(c) && !failed.includes(c))
      return clis.flatMap((cli) => recipeOf(cli)[removing ? 'uninstall' : 'install'].map((s) => normalizeStep(s, cli)))
    },

    async install(ctx) {
      await runSteps(this.steps('install', ctx.state), ctx)
    },

    async uninstall(ctx) {
      await runSteps(this.steps('uninstall', ctx.state), ctx)
    },
  }
}

function tail(output) {
  return String(output ?? '').trim().split(/\r?\n/).slice(-TAIL_LINES).join('\n    ')
}

const cliLabel = (cli) => CLIS[cli]?.label ?? cli

// 한 CLI의 단계가 실패하면 그 CLI의 남은 단계만 건너뛴다. 다른 CLI는 계속
// 간다 — 로그인이 풀린 Codex 하나 때문에 Claude 설치까지 막을 이유가 없다.
export async function runSteps(steps, ctx) {
  const { root, exec, dryRun = false, log = () => {} } = ctx
  const broken = new Set()
  // 참아 준 실패(마켓플레이스 "이미 등록됨")는 뒤 단계가 실패할 때만 함께 보인다.
  const soft = new Map()
  const failures = []
  for (const step of steps) {
    if (broken.has(step.cli)) continue
    if (step.fn) {
      if (dryRun) { log(`  [dry-run] ${step.describe}`); continue }
      try {
        await step.fn(ctx)
      } catch (err) {
        failures.push({ cli: step.cli, what: step.describe, output: err.message })
        broken.add(step.cli)
      }
      continue
    }
    const [cmd, ...args] = step.argv
    const opts = { cwd: step.cwd ? join(root, step.cwd) : root }
    if (step.timeout) opts.timeout = step.timeout
    const r = await exec(cmd, args, opts)
    if (r.ok) continue
    const failure = { cli: step.cli, what: step.argv.join(' '), output: tail(r.output) }
    if (step.tolerateFail) { soft.set(step.cli, failure); continue }
    if (step.undo && !dryRun) {
      try { await step.undo(ctx) } catch { /* 되돌리기 실패가 원래 실패를 가리면 안 된다 */ }
    }
    if (soft.has(step.cli)) failures.push(soft.get(step.cli))
    failures.push(failure)
    broken.add(step.cli)
  }
  if (failures.length > 0) {
    const details = failures.map((f) => `  ${cliLabel(f.cli)}: ${f.what}${f.output ? `\n    ${f.output}` : ''}`).join('\n')
    throw new LocalizedError('error.stepsFailed', { details })
  }
}

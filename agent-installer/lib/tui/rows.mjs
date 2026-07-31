// 부트스트랩·에이전트·design.md를 하나의 행 배열로 합친다.
// 화면을 모른다 — 폭도 색도 커서도 여기서는 다루지 않는다.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { scan } from '../engine.mjs'
import { loadItems } from '../catalog.mjs'
import { runBootstrap } from '../bootstrap/flow.mjs'
import { MANIFEST } from '../bootstrap/manifest.mjs'
import { createT } from '../i18n/index.mjs'
import { loadCatalog, buildItems, netFetch, CATALOG_PATH } from '../design-md/catalog.mjs'
import { discoverSources, extraDirsFromEnv } from '../design-md/scan.mjs'
import { refreshCatalog, updateInstalled, findStale } from '../design-md/flow.mjs'

const AGENT_SECTION = { plugin: 'PLUGIN', mcp: 'MCP', skill: 'SKILL' }
const STATUS_LABEL = { installed: '설치됨', partial: '일부 설치됨', absent: '미설치' }
const DESIGN_STATUS = { installed: '설치됨', partial: '일부', absent: '미설치' }

export const ACTION_SECTION = '작업'
// scan.mjs의 BUNDLE_CATEGORY와 같은 값이다 — 카테고리를 못 얻은 항목이 모이는 자리.
export const CATCH_ALL_CATEGORY = '기타'
export const SECTION_ORDER = [ACTION_SECTION, 'PLUGIN', 'MCP', 'SKILL', 'DESIGN.MD']

function short(text, n = 60) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

// 에이전트 항목 힌트 — 상태·설치 위치·미지원 CLI 사유까지 한 줄에 담는다.
export function agentHint(item, state) {
  const parts = []
  if (state.status !== 'absent') parts.push(STATUS_LABEL[state.status])
  if (state.detail) parts.push(state.detail)
  if (item.scope === 'user') parts.push('설치 위치: 사용자 글로벌')
  const un = Object.entries(item.unsupported ?? {})
  if (item.category === 'mcp' && un.length > 0) {
    parts.push(`미지원: ${un.map(([cli, why]) => `${cli}(${why})`).join(', ')}`)
  }
  if (item.supports?.length === 1 && item.supports[0] === 'claude') parts.push('Claude Code 전용')
  if (item.note) parts.push(item.note)
  return parts.join(' · ')
}

export function designHint(state, multiProvider = false) {
  const parts = []
  if (multiProvider) parts.push(state.item.providerId)
  parts.push(state.item.designCategory)
  if (state.status !== 'absent') parts.push(DESIGN_STATUS[state.status])
  if (state.item.description) parts.push(short(state.item.description))
  return parts.filter(Boolean).join(' · ')
}

// group = 탭 **안쪽**의 소분류 헤더. design.md만 76개라 카테고리로 갈라야 읽힌다.
// 나머지 탭은 항목이 적어 그룹 없이 평평하게 둔다.
function itemRow({ id, section, label, hint, status, previewTarget = null, item, extra = '', group = null }) {
  return {
    kind: 'item',
    id,
    section,
    group,
    label,
    hint,
    status,
    previewTarget,
    item,
    searchText: `${label} ${hint} ${section} ${extra}`.toLowerCase(),
  }
}

function actionRow({ id, label, hint, run }) {
  return {
    kind: 'action',
    id,
    section: ACTION_SECTION,
    group: null,
    label,
    hint,
    status: 'absent',
    previewTarget: null,
    run,
    searchText: `${label} ${hint} ${ACTION_SECTION}`.toLowerCase(),
  }
}

// 부트스트랩이 만들 파일 중 이미 있는 수 — 실행 전에 무엇이 남았는지 알려 준다.
function bootstrapHint(root) {
  const present = MANIFEST.files.filter((f) => existsSync(join(root, f.path))).length
  return `지침 · 스킬 · 도구별 설정 · 파일 ${MANIFEST.files.length}개 중 ${present}개 존재`
}

export function buildActions(root, { designItems = [] } = {}) {
  return [
    actionRow({
      id: 'action.bootstrap',
      label: '부트스트랩 실행',
      hint: bootstrapHint(root),
      // TUI는 아직 로케일을 고르지 않는다(Task 9~11) — 지금까지와 같은 한국어
      // 출력을 유지하기 위해 못박아 둔다.
      run: ({ dryRun, skillMode, log }) => runBootstrap(root, { dryRun, skillMode, log, t: createT('ko') }),
    }),
    actionRow({
      id: 'action.sync.installed',
      label: '설치본 업데이트',
      hint: 'design.md 설치본을 원본 최신으로 다시 받는다',
      run: ({ dryRun, log }) => updateInstalled(root, designItems, { dryRun, log }),
    }),
    actionRow({
      id: 'action.sync.catalog',
      label: '카탈로그 새로고침',
      hint: 'design.md 목록·카테고리를 소스에서 다시 만든다',
      run: ({ dryRun, fetchImpl, log, catalogFile }) => refreshCatalog({ dryRun, fetchImpl, log, catalogFile }),
    }),
    actionRow({
      id: 'action.sync.stale',
      label: '오래된 항목 확인',
      hint: '설치본을 원본과 해시 비교한다',
      run: async ({ dryRun, log, confirm }) => {
        const stale = await findStale(root, designItems, { log })
        if (stale.length === 0) { log('모든 설치본이 최신입니다.'); return }
        log(`오래된 항목 ${stale.length}개: ${stale.map((i) => i.name).join(', ')}`)
        if (dryRun) return
        if (!(await confirm(`${stale.length}개를 지금 업데이트할까요?`))) return
        for (const item of stale) {
          try {
            await item.install({ root, dryRun, fresh: true })
            log(`  ✔ 업데이트 ${item.label}`)
          } catch (err) {
            log(`  ✖ 업데이트 ${item.label} — ${err.message}`)
          }
        }
      },
    }),
  ]
}

// 순수 조립 — 이미 스캔된 상태를 받아 행 배열을 만든다. 테스트는 여기를 겨눈다.
export function buildRows({ actions = [], agentStates = [], designStates = [], multiProvider = false }) {
  const agents = agentStates.map((s) =>
    itemRow({
      id: s.item.id,
      section: AGENT_SECTION[s.item.category] ?? s.item.category.toUpperCase(),
      label: s.item.label,
      hint: agentHint(s.item, s),
      status: s.status,
      item: s.item,
      extra: s.item.id,
    }),
  )

  // 카테고리 → 라벨 순으로 정렬한다. 그룹 헤더는 인접한 같은 group을 하나로 묶으므로
  // 정렬이 흐트러지면 같은 카테고리가 여러 번 쪼개져 나온다.
  const designs = designStates
    .map((s) =>
      itemRow({
        id: s.item.id,
        section: 'DESIGN.MD',
        group: s.item.designCategory || CATCH_ALL_CATEGORY,
        label: s.item.label,
        hint: designHint(s, multiProvider),
        status: s.status,
        previewTarget: s.item.webUrl ?? s.item.previewPath ?? null,
        item: s.item,
        extra: `${s.item.name} ${s.item.providerId}`,
      }),
    )
    // 분류 못 한 항목을 모아 둔 '기타'는 맨 뒤로 보낸다 — catch-all이 목록 머리를 차지하면
    // 실제 카테고리를 훑기 전에 잡동사니부터 읽게 된다.
    .sort((a, b) =>
      (a.group === CATCH_ALL_CATEGORY ? 1 : 0) - (b.group === CATCH_ALL_CATEGORY ? 1 : 0)
      || a.group.localeCompare(b.group)
      || a.label.localeCompare(b.label))

  const rows = [...actions, ...agents, ...designs]
  // 섹션 순서를 고정한다 — displayList가 인접한 같은 섹션을 하나로 묶기 때문이다.
  return rows.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section))
}

// 스캔까지 포함한 수집. 적용·액션 실행 뒤 다시 부른다.
export async function collectRows(root, opts = {}) {
  const { fetchImpl = netFetch, designDirs = [], env = process.env, catalogFile = CATALOG_PATH, log = () => {} } = opts

  const agentItems = await loadItems()
  const catalog = loadCatalog(catalogFile)
  const sources = opts.sources ?? discoverSources({
    ...(opts.bundleDir ? { bundleDir: opts.bundleDir } : {}),
    extraDirs: [...extraDirsFromEnv(env), ...designDirs],
    log,
  })
  const designItems = buildItems(catalog, { fetchImpl, sources })

  const [agentStates, designStates] = await Promise.all([scan(root, agentItems), scan(root, designItems)])
  const multiProvider = new Set(designItems.map((i) => i.providerId)).size > 1

  return {
    rows: buildRows({
      actions: buildActions(root, { designItems }),
      agentStates,
      designStates,
      multiProvider,
    }),
    agentStates,
    designStates,
    designItems,
  }
}

// 설치된 항목 = 시작 시 체크된 항목.
export function installedIds(rows) {
  return rows.filter((r) => r.kind === 'item' && r.status !== 'absent').map((r) => r.id)
}

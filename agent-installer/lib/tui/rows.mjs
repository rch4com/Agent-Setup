// 부트스트랩·에이전트·design.md를 하나의 행 배열로 합친다.
// 화면을 모른다 — 폭도 색도 커서도 여기서는 다루지 않는다.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { scan } from '../engine.mjs'
import { loadItems } from '../catalog.mjs'
import { runBootstrap } from '../bootstrap/flow.mjs'
import { MANIFEST } from '../bootstrap/manifest.mjs'
import { createT, toText } from '../i18n/index.mjs'
import { loadCatalog, buildItems, netFetch, CATALOG_PATH } from '../design-md/catalog.mjs'
import { discoverSources, extraDirsFromEnv } from '../design-md/scan.mjs'
import { refreshCatalog, updateInstalled, findStale, categoryLabel } from '../design-md/flow.mjs'

// 섹션은 탭 이름이자 정렬 키이자 state.tabs의 원소다. 표시 문자열을 그대로
// 쓰면 번역하는 순간 정렬이 깨진다 — id를 두고 render.mjs가 표시할 때만
// t로 바꾼다. 덕분에 state.mjs는 계속 아무것도 import 하지 않는다.
export const ACTION_SECTION = 'action'
// design-md/scan.mjs의 BUNDLE_CATEGORY와 같은 값이다 — 카테고리를 못 얻은
// 항목이 모이는 자리. 두 값이 갈리면 같은 그룹이 두 개로 쪼개진다.
export const CATCH_ALL_CATEGORY = '__other'
export const SECTION_ORDER = [ACTION_SECTION, 'plugin', 'mcp', 'skill', 'design']

function short(text, n = 60) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

// buildActions의 run 콜백(부트스트랩·design-md 동기화 실행부)은 아직 이 값에
// 고정한다 — 화면 라벨·힌트는 Task 10에서 t로 옮겼지만, 실행 로그까지 활성
// 로케일을 따라가게 하는 일은 이 태스크의 범위 밖이다(Task 11 이후 과제).
const T_KO = createT('ko')

// 검색어에 섹션의 두 로케일 라벨을 모두 넣는다 — 한국어 화면에서도 영어 탭
// 이름(plugin 등)으로 찾을 수 있어야 한다. 두 라벨이 같으면(PLUGIN·MCP처럼
// 번역하지 않는 값) 중복으로 넣지 않는다.
const EN_T = createT('en')

function sectionTerms(t, section) {
  const here = t(`section.${section}`)
  const base = EN_T(`section.${section}`)
  return here === base ? `${section} ${base}` : `${section} ${base} ${here}`
}

// 에이전트 항목 힌트 — 상태·설치 위치·미지원 CLI 사유까지 한 줄에 담는다.
export function agentHint(item, state, t = createT('en')) {
  const parts = []
  if (state.status !== 'absent') parts.push(t(`status.${state.status}`))
  const detail = toText(t, state.detail)
  if (detail) parts.push(detail)
  if (item.scope === 'user') parts.push(t('item.location.user'))
  const un = Object.entries(item.unsupported ?? {})
  if (item.category === 'mcp' && un.length > 0) {
    parts.push(t('item.unsupportedList', {
      list: un.map(([cli, why]) => `${cli}(${toText(t, why)})`).join(', '),
    }))
  }
  if (item.supports?.length === 1 && item.supports[0] === 'claude') parts.push(t('item.claudeOnly'))
  // note는 이제 카탈로그 키다.
  if (item.note) parts.push(t(item.note))
  return parts.join(' · ')
}

export function designHint(state, multiProvider = false, t) {
  const parts = []
  if (multiProvider) parts.push(state.item.providerId)
  // 카탈로그가 준 카테고리는 그대로, 우리가 만든 catch-all(__other·__local)만
  // categoryLabel이 번역한다.
  parts.push(categoryLabel(t, state.item.designCategory))
  if (state.status !== 'absent') parts.push(t(`status.${state.status}`))
  if (state.item.description) parts.push(short(state.item.description))
  return parts.filter(Boolean).join(' · ')
}

// group = 탭 **안쪽**의 소분류 헤더. design.md만 76개라 카테고리로 갈라야 읽힌다.
// 나머지 탭은 항목이 적어 그룹 없이 평평하게 둔다.
function itemRow({ id, section, label, hint, status, previewTarget = null, item, extra = '', group = null, t = createT('en') }) {
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
    searchText: `${label} ${hint} ${sectionTerms(t, section)} ${extra}`.toLowerCase(),
  }
}

function actionRow({ id, label, hint, run, t = createT('en') }) {
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
    searchText: `${label} ${hint} ${sectionTerms(t, ACTION_SECTION)}`.toLowerCase(),
  }
}

// 부트스트랩이 만들 파일 중 이미 있는 수 — 실행 전에 무엇이 남았는지 알려 준다.
function bootstrapHint(root, t) {
  const present = MANIFEST.files.filter((f) => existsSync(join(root, f.path))).length
  return t('action.bootstrap.hint', { present, total: MANIFEST.files.length })
}

export function buildActions(root, { designItems = [], t = createT('en') } = {}) {
  return [
    actionRow({
      id: 'action.bootstrap',
      label: t('action.bootstrap.label'),
      hint: bootstrapHint(root, t),
      // 실행 로그는 아직 한국어로 고정한다 — T_KO 주석 참고.
      run: ({ dryRun, skillMode, log }) => runBootstrap(root, { dryRun, skillMode, log, t: createT('ko') }),
      t,
    }),
    actionRow({
      id: 'action.sync.installed',
      label: t('action.sync.installed.label'),
      hint: t('action.sync.installed.hint'),
      run: ({ dryRun, log }) => updateInstalled(root, designItems, { dryRun, log, t: T_KO }),
      t,
    }),
    actionRow({
      id: 'action.sync.catalog',
      label: t('action.sync.catalog.label'),
      hint: t('action.sync.catalog.hint'),
      run: ({ dryRun, fetchImpl, log, catalogFile }) => refreshCatalog({ dryRun, fetchImpl, log, catalogFile, t: T_KO }),
      t,
    }),
    actionRow({
      id: 'action.sync.stale',
      label: t('action.sync.stale.label'),
      hint: t('action.sync.stale.hint'),
      run: async ({ dryRun, log, confirm }) => {
        const stale = await findStale(root, designItems, { log, t: T_KO })
        // 이 네 줄은 flow.mjs의 runSync(design --sync=stale)가 쓰는 문구와 같다 —
        // 새 키를 만들지 않고 그 키(design.allCurrent 등)를 그대로 재사용한다.
        if (stale.length === 0) { log(T_KO('design.allCurrent')); return }
        log(T_KO('design.staleList', { count: stale.length, names: stale.map((i) => i.name).join(', ') }))
        if (dryRun) return
        if (!(await confirm(T_KO('design.staleConfirm', { count: stale.length })))) return
        for (const item of stale) {
          try {
            await item.install({ root, dryRun, fresh: true })
            log(T_KO('design.updated', { label: item.label }))
          } catch (err) {
            log(T_KO('design.updateFailed', { label: item.label, message: err.message }))
          }
        }
      },
      t,
    }),
  ]
}

// 순수 조립 — 이미 스캔된 상태를 받아 행 배열을 만든다. 테스트는 여기를 겨눈다.
export function buildRows({ actions = [], agentStates = [], designStates = [], multiProvider = false, t = createT('en') }) {
  const agents = agentStates.map((s) =>
    itemRow({
      id: s.item.id,
      section: s.item.category,
      label: s.item.label,
      hint: agentHint(s.item, s, t),
      status: s.status,
      item: s.item,
      extra: s.item.id,
      t,
    }),
  )

  // 카테고리 → 라벨 순으로 정렬한다. 그룹 헤더는 인접한 같은 group을 하나로 묶으므로
  // 정렬이 흐트러지면 같은 카테고리가 여러 번 쪼개져 나온다.
  const designs = designStates
    .map((s) =>
      itemRow({
        id: s.item.id,
        section: 'design',
        group: s.item.designCategory || CATCH_ALL_CATEGORY,
        label: s.item.label,
        hint: designHint(s, multiProvider, t),
        status: s.status,
        previewTarget: s.item.webUrl ?? s.item.previewPath ?? null,
        item: s.item,
        extra: `${s.item.name} ${s.item.providerId}`,
        t,
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
  const { fetchImpl = netFetch, designDirs = [], env = process.env, catalogFile = CATALOG_PATH, log = () => {}, t = createT('en') } = opts

  const agentItems = await loadItems()
  const catalog = loadCatalog(catalogFile)
  const sources = opts.sources ?? discoverSources({
    ...(opts.bundleDir ? { bundleDir: opts.bundleDir } : {}),
    extraDirs: [...extraDirsFromEnv(env), ...designDirs],
    log,
    t,
  })
  const designItems = buildItems(catalog, { fetchImpl, sources })

  const [agentStates, designStates] = await Promise.all([scan(root, agentItems), scan(root, designItems)])
  const multiProvider = new Set(designItems.map((i) => i.providerId)).size > 1

  return {
    rows: buildRows({
      actions: buildActions(root, { designItems, t }),
      agentStates,
      designStates,
      multiProvider,
      t,
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

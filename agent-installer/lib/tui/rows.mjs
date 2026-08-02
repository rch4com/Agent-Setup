// 부트스트랩·에이전트·design.md를 하나의 행 배열로 합친다.
// 화면을 모른다 — 폭도 색도 커서도 여기서는 다루지 않는다.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { scan } from '../engine.mjs'
import { loadItems } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { runBootstrap } from '../bootstrap/flow.mjs'
import { MANIFEST } from '../bootstrap/manifest.mjs'
import { createT, toText } from '../i18n/index.mjs'
import { loadCatalog, buildItems, netFetch, CATALOG_PATH } from '../design-md/catalog.mjs'
import { discoverSources, extraDirsFromEnv } from '../design-md/scan.mjs'
import { refreshCatalog, updateInstalled, findStale, categoryLabel } from '../design-md/flow.mjs'
import { unsupportedGroups } from './detail.mjs'

// 섹션은 탭 이름이자 정렬 키이자 state.tabs의 원소다. 표시 문자열을 그대로
// 쓰면 번역하는 순간 정렬이 깨진다 — id를 두고 render.mjs가 표시할 때만
// t로 바꾼다. 덕분에 state.mjs는 계속 아무것도 import 하지 않는다.
export const ACTION_SECTION = 'action'
// design-md/scan.mjs의 BUNDLE_CATEGORY와 같은 값이다 — 카테고리를 못 얻은
// 항목이 모이는 자리. 두 값이 갈리면 같은 그룹이 두 개로 쪼개진다.
export const CATCH_ALL_CATEGORY = '__other'
export const SECTION_ORDER = [ACTION_SECTION, 'plugin', 'mcp', 'skill', 'config', 'design']

// 탭 안쪽 소분류는 **성격**으로 가른다 — 같은 탭에 "무엇으로 설치되는가"가 같고
// "무엇을 해 주는가"가 다른 항목이 섞여 있어서, 기구(plugin·mcp·skill)만으로는
// 고를 때 비교가 되지 않는다. 표시 순서는 이 배열이 정한다.
// `__`로 시작하는 id만 categoryLabel이 번역한다(design.md 카테고리와 같은 규칙).
export const GROUP_ORDER = ['__token', '__context', '__style', '__flow', '__service']

function groupRank(group) {
  const i = GROUP_ORDER.indexOf(group)
  // 그룹이 없거나 목록에 없는 항목은 맨 뒤로 — 헤더 없이 평평하게 붙는다.
  return i === -1 ? GROUP_ORDER.length : i
}

function short(text, n = 60) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

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
// 미지원 CLI를 **같은 사유끼리 묶어** 한 줄로 만든다. 사유 하나가 CLI 아홉 개에
// 그대로 반복되면 줄만 길어지고 "무엇이 왜 빠졌는가"는 오히려 묻힌다.
// 사유가 둘 이상이면(ponytail처럼) 갈래가 그대로 보인다.
// 그룹핑은 detail.mjs가 한다 — 상세 패널과 규칙을 한 곳에 둔다.
export function unsupportedText(item, t) {
  const groups = unsupportedGroups(item, t)
  if (groups.length === 0) return null
  const count = groups.reduce((n, g) => n + g.clis.length, 0)
  const text = groups
    .map((g) => t('item.unsupportedGroup', { clis: g.clis.join('·'), why: g.why }))
    .join(' / ')
  return t('item.unsupportedList', { count, groups: text })
}

// 에이전트 항목 힌트 — 상태·CLI 커버리지·설치 위치·미지원 사유까지 한 줄에 담는다.
export function agentHint(item, state, t = createT('en')) {
  const parts = []
  if (state.status !== 'absent') parts.push(t(`status.${state.status}`))
  // 커버리지는 상태 바로 뒤에 둔다. 힌트 끝은 좁은 터미널에서 잘려 나가는데,
  // 하필 그때가 "이 항목이 내가 쓰는 CLI에서 되나"를 가장 알고 싶은 순간이다.
  // 전부 지원할 때도 찍는다 — 표시가 없는 것과 "10/10"은 뜻이 다르다.
  if (item.supports) parts.push(t('item.cliCoverage', { covered: item.supports.length, total: CLI_IDS.length }))
  const detail = toText(t, state.detail)
  if (detail) parts.push(detail)
  if (item.scope === 'user') parts.push(t('item.location.user'))
  // note는 이제 카탈로그 키다.
  if (item.note) parts.push(t(item.note))
  // 사유는 길어질 수 있어 맨 뒤에 둔다 — 앞의 커버리지가 이미 "빠진 게 있다"를
  // 알려 주므로, 잘려도 존재 자체를 놓치지는 않는다.
  const un = unsupportedText(item, t)
  if (un) parts.push(un)
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

// 목록 행에 실제로 찍히는 힌트. 80칸 터미널이면 힌트 자리는 49칸(한글 24자)뿐이라,
// 예전처럼 사유까지 이어 붙이면 뒤쪽이 통째로 잘렸다. 사유·note·detail은
// 상세 패널이 여러 줄로 편다 — 여기 남는 것은 잘릴 일이 없는 두 가지뿐이다.
export function agentShortHint(item, state, t = createT('en')) {
  const parts = []
  if (state.status !== 'absent') parts.push(t(`status.${state.status}`))
  if (item.supports) parts.push(t('item.cliCoverage', { covered: item.supports.length, total: CLI_IDS.length }))
  return parts.join(' · ')
}

// design.md도 같은 이유로 줄인다. 설명 전문은 상세 패널이 맡는다.
export function designShortHint(state, multiProvider = false, t = createT('en')) {
  const parts = []
  if (multiProvider) parts.push(state.item.providerId)
  parts.push(categoryLabel(t, state.item.designCategory))
  if (state.status !== 'absent') parts.push(t(`status.${state.status}`))
  return parts.filter(Boolean).join(' · ')
}

// group = 탭 **안쪽**의 소분류 헤더. design.md만 76개라 카테고리로 갈라야 읽힌다.
// 나머지 탭은 항목이 적어 그룹 없이 평평하게 둔다.
function itemRow({ id, section, label, hint, fullHint = hint, statusDetail = null, status, previewTarget = null, item, extra = '', group = null, t = createT('en') }) {
  return {
    kind: 'item',
    id,
    section,
    group,
    // 같은 파일을 두고 다투는 항목들의 묶음 이름(.gitmessage.txt의 두 언어판).
    // 선택 배타는 state.mjs가 이 값만 보고 처리한다 — 순수 리듀서가 항목의
    // 속내를 몰라도 되게 행에 미리 올려 둔다.
    exclusive: item?.exclusive ?? null,
    label,
    hint,
    // 화면에 안 찍히는 긴 힌트. 비대화형 목록(printPlain)과 검색이 쓴다 —
    // 짧은 힌트로 검색하면 'AGENTS.md'로 ponytail을 찾을 수 없게 된다.
    fullHint,
    statusDetail,
    status,
    previewTarget,
    item,
    searchText: `${label} ${fullHint} ${sectionTerms(t, section)} ${extra}`.toLowerCase(),
  }
}

function actionRow({ id, label, hint, run = null, t = createT('en') }) {
  return {
    kind: 'action',
    id,
    section: ACTION_SECTION,
    group: null,
    exclusive: null,
    label,
    hint,
    fullHint: hint,
    statusDetail: null,
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
    // 맨 위 상주 행. 실행은 run.mjs가 특수 처리한다 — 화면을 벗어나지 않고
    // 그 자리에서 t를 갈아끼워야 하므로 다른 액션과 흐름이 다르다(run은 null).
    actionRow({
      id: 'action.language',
      label: t('action.language.label'),
      hint: t('action.language.hint', { current: t(`locale.${t.locale}`) }),
      t,
    }),
    actionRow({
      id: 'action.bootstrap',
      label: t('action.bootstrap.label'),
      hint: bootstrapHint(root, t),
      run: ({ dryRun, skillMode, log, t: rt }) => runBootstrap(root, { dryRun, skillMode, log, t: rt }),
      t,
    }),
    actionRow({
      id: 'action.sync.installed',
      label: t('action.sync.installed.label'),
      hint: t('action.sync.installed.hint'),
      run: ({ dryRun, log, t: rt }) => updateInstalled(root, designItems, { dryRun, log, t: rt }),
      t,
    }),
    actionRow({
      id: 'action.sync.catalog',
      label: t('action.sync.catalog.label'),
      hint: t('action.sync.catalog.hint'),
      run: ({ dryRun, fetchImpl, log, catalogFile, t: rt }) => refreshCatalog({ dryRun, fetchImpl, log, catalogFile, t: rt }),
      t,
    }),
    actionRow({
      id: 'action.sync.stale',
      label: t('action.sync.stale.label'),
      hint: t('action.sync.stale.hint'),
      run: async ({ dryRun, log, confirm, t: rt }) => {
        const stale = await findStale(root, designItems, { log, t: rt })
        // 이 네 줄은 flow.mjs의 runSync(design --sync=stale)가 쓰는 문구와 같다 —
        // 새 키를 만들지 않고 그 키(design.allCurrent 등)를 그대로 재사용한다.
        if (stale.length === 0) { log(rt('design.allCurrent')); return }
        log(rt('design.staleList', { count: stale.length, names: stale.map((i) => i.name).join(', ') }))
        if (dryRun) return
        if (!(await confirm(rt('design.staleConfirm', { count: stale.length })))) return
        for (const item of stale) {
          try {
            await item.install({ root, dryRun, fresh: true })
            log(rt('design.updated', { label: item.label }))
          } catch (err) {
            log(rt('design.updateFailed', { label: item.label, message: err.message }))
          }
        }
      },
      t,
    }),
  ]
}

// 순수 조립 — 이미 스캔된 상태를 받아 행 배열을 만든다. 테스트는 여기를 겨눈다.
export function buildRows({ actions = [], agentStates = [], designStates = [], multiProvider = false, t = createT('en') }) {
  const agents = agentStates
    .map((s) =>
      itemRow({
        id: s.item.id,
        section: s.item.category,
        group: s.item.group ?? null,
        label: s.item.label,
        hint: agentShortHint(s.item, s, t),
        fullHint: agentHint(s.item, s, t),
        statusDetail: toText(t, s.detail) ?? null,
        status: s.status,
        item: s.item,
        extra: s.item.id,
        t,
      }),
    )
    // 성격 → 라벨 순. 헤더는 인접한 같은 group을 하나로 묶으므로, 정렬이
    // 흐트러지면 같은 성격이 한 탭에서 여러 번 쪼개져 나온다(design과 같은 규칙).
    .sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.label.localeCompare(b.label))

  // 카테고리 → 라벨 순으로 정렬한다. 그룹 헤더는 인접한 같은 group을 하나로 묶으므로
  // 정렬이 흐트러지면 같은 카테고리가 여러 번 쪼개져 나온다.
  const designs = designStates
    .map((s) =>
      itemRow({
        id: s.item.id,
        section: 'design',
        group: s.item.designCategory || CATCH_ALL_CATEGORY,
        label: s.item.label,
        hint: designShortHint(s, multiProvider, t),
        fullHint: designHint(s, multiProvider, t),
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

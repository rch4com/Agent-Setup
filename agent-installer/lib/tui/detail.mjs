// 상세 패널 — 커서가 놓인 항목의 전문을 여러 줄로 편다.
// 순수 함수 모듈이다. 색도 커서도 터미널도 모른다 — render.mjs가 배치하고 칠한다.
//
// rows.mjs를 import 하지 않는 것이 규칙이다. render.mjs가 이 모듈을 쓰므로,
// 여기서 rows를 끌어오면 render → detail → rows 방향이 생겨 rows.mjs가 순수
// 렌더 층의 의존성이 된다. 그래서 사유 그룹핑이 rows가 아니라 여기 있고,
// rows.mjs가 반대로 여기서 가져다 쓴다.
import { toText, createT } from '../i18n/index.mjs'
import { CLIS } from '../clis.mjs'
import { categoryLabel } from '../design-md/flow.mjs'
import { cut, pad, width, wrap } from '../width.mjs'

// 미배선 사유를 **같은 사유끼리** 묶는다. 사유 하나가 CLI 아홉 개에 그대로
// 반복되면 줄만 길어지고 "무엇이 왜 빠졌는가"는 오히려 묻힌다.
// 사유가 둘 이상이면(ponytail처럼) 갈래가 그대로 보인다.
export function unsupportedGroups(item, t) {
  const entries = Object.entries(item?.unsupported ?? {})
  if (entries.length === 0) return []
  const byReason = new Map()
  for (const [cli, why] of entries) {
    const text = toText(t, why)
    if (!byReason.has(text)) byReason.set(text, [])
    byReason.get(text).push(cli)
  }
  return [...byReason].map(([why, clis]) => ({ clis, why }))
}

// '배선  ' / '미배선 ' 라벨 자리. 로케일마다 길이가 달라 상수로 박으면 열이
// 어긋난다 — 그 로케일의 실제 라벨에서 폭을 뽑는다.
function leadWidth(t) {
  return Math.max(width(t('detail.wired')), width(t('detail.unwired'))) + 1
}

function headLine(row, w, t) {
  const item = row.item
  // item.scope는 오늘 모든 항목 종류가 채운다 — 그래도 이 값 하나로 화면
  // 전체가 죽을 수는 없다. t()는 모르는 키에 던지고(i18n/index.mjs) 이
  // 함수는 render() 안에서 돈다 — 항목 하나의 결손이 패널 하나가 아니라
  // TUI 전체를 끌고 내려간다.
  const bits = [item.category, item.scope ? t(`detail.scope.${item.scope}`) : null, t(`status.${row.status}`)]
  return cut(`${item.label}   ${bits.filter(Boolean).join(' · ')}`, w)
}

function wiredLines(item, w, lead, t) {
  const supports = item.supports ?? []
  if (supports.length === 0) return []
  // 경로는 MCP에서만 붙인다. 그때만 clis.mjs 어댑터가 경로의 유일한 진실이다 —
  // plugin·skill은 설치 자리가 항목마다 달라 어댑터가 알지 못한다.
  const showFile = item.category === 'mcp'
  const nameWidth = Math.max(...supports.map((c) => width(c)))
  return supports.map((cli, i) => {
    const head = i === 0 ? pad(t('detail.wired'), lead) : ' '.repeat(lead)
    const file = showFile && CLIS[cli]?.file ? `  ${CLIS[cli].file}` : ''
    // 이름 뒤에 열이 없으면 맞출 대상도 없다 — 경로가 붙는 mcp에서만 이름을 편다.
    const name = showFile ? pad(cli, nameWidth) : cli
    return cut(`${head}✔ ${name}${file}`, w)
  })
}

function unwiredLines(item, w, lead, t) {
  const out = []
  unsupportedGroups(item, t).forEach((group, i) => {
    const head = i === 0 ? pad(t('detail.unwired'), lead) : ' '.repeat(lead)
    out.push(cut(`${head}✖ ${group.clis.join('·')}`, w))
    // 사유는 한 칸 더 들여 이어 붙인다. 첫 줄만 └를 달아 어느 CLI 묶음의
    // 사유인지 눈으로 잇는다.
    wrap(group.why, Math.max(1, w - lead - 3)).forEach((line, j) => {
      out.push(cut(`${' '.repeat(lead + 1)}${j === 0 ? '└ ' : '  '}${line}`, w))
    })
  })
  return out
}

function agentLines(row, w, t) {
  const item = row.item
  const lead = leadWidth(t)
  const out = [headLine(row, w, t)]
  if (item.note) out.push(...wrap(t(item.note), w))
  if (row.statusDetail) out.push(...wrap(row.statusDetail, w))
  out.push(...wiredLines(item, w, lead, t))
  out.push(...unwiredLines(item, w, lead, t))
  return out
}

function designLines(row, w, t) {
  const item = row.item
  const lead = leadWidth(t)
  const bits = [item.category, categoryLabel(t, item.designCategory), t(`status.${row.status}`)]
  const out = [cut(`${item.label}   ${bits.filter(Boolean).join(' · ')}`, w)]
  if (item.providerId) out.push(cut(`${pad(t('detail.provider'), lead)}${item.providerId}`, w))
  const target = row.previewTarget ?? item.webUrl ?? item.previewPath
  if (target) out.push(cut(`${pad(t('detail.preview'), lead)}${target}`, w))
  if (item.description) out.push(...wrap(item.description, w))
  return out
}

// 액션 행은 체크 대상이 아니라 실행 대상이다 — 배선표가 없다.
function actionLines(row, w) {
  return [cut(row.label, w), ...wrap(row.fullHint ?? row.hint ?? '', w)]
}

// 행 하나와 지면 크기를 받아 줄 배열을 돌려준다. 색도 커서도 모른다.
export function detailLines(row, { width: columns = 80, height = 8, t = createT('en') } = {}) {
  if (!row || height <= 0) return []
  const w = Math.max(20, columns)
  const lines = row.kind === 'action'
    ? actionLines(row, w)
    : row.item?.category === 'design' ? designLines(row, w, t) : agentLines(row, w, t)

  if (lines.length <= height) return lines
  // 넘치면 조용히 자르지 않는다 — 남은 줄 수와 펼치는 길을 함께 알린다.
  // 안내줄이 한 줄을 차지하므로 본문은 height - 1줄만 쓴다. height===1이면
  // 그 한 줄조차 없어 안내줄 하나가 전부를 대신하고, 그때는 "한 줄 빼고 남은
  // 수"가 아니라 "전부"를 세어야 거짓말이 되지 않는다.
  const room = height - 1
  const marker = cut(t('detail.more', { count: lines.length - Math.max(0, room) }), w)
  return room <= 0 ? [marker] : [...lines.slice(0, room), marker]
}

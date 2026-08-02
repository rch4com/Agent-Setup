// 상세 패널 — 커서가 놓인 항목의 전문을 여러 줄로 편다.
// 순수 함수 모듈이다. 색도 커서도 터미널도 모른다 — render.mjs가 배치하고 칠한다.
//
// rows.mjs를 import 하지 않는 것이 규칙이다. render.mjs가 이 모듈을 쓰므로,
// 여기서 rows를 끌어오면 render → detail → rows 방향이 생겨 rows.mjs가 순수
// 렌더 층의 의존성이 된다. 그래서 사유 그룹핑이 rows가 아니라 여기 있고,
// rows.mjs가 반대로 여기서 가져다 쓴다.
import { toText } from '../i18n/index.mjs'

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

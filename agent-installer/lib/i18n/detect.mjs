// OS 언어 감지. 순수 함수다 — env와 Intl 결과를 인자로 받는다.
// 여기서 지원 여부를 판단하지 않는다: OS가 뭐라고 하는지만 그대로 보고하고,
// 그중 무엇을 쓸지는 resolveLocale이 정한다. 둘을 섞으면 "감지는 됐는데
// 지원하지 않아 영어로 갔다"와 "감지 자체가 실패했다"를 구별할 수 없다.

// POSIX 관례상 뒤에 오는 것이 앞을 덮지 않는다 — 먼저 잡히는 것이 이긴다.
const ENV_KEYS = ['LC_ALL', 'LC_MESSAGES', 'LANG', 'LANGUAGE']

// 로케일을 지정하지 않았다는 뜻의 값. 여기서 멈추면 Intl로 내려가지 못한다.
const NEUTRAL = new Set(['c', 'posix'])

// `ko_KR.UTF-8` · `en_US:en` · `ko-KR` 을 모두 `ko`/`en`으로 줄인다.
// `.`은 인코딩, `@`는 변형(modifier), `:`은 LANGUAGE의 목록 구분자다.
export function baseTag(raw) {
  if (typeof raw !== 'string') return null
  const head = raw.trim().split(/[.:@]/)[0]
  if (!head) return null
  if (NEUTRAL.has(head.toLowerCase())) return null
  const tag = head.replace(/_/g, '-').split('-')[0].toLowerCase()
  return tag || null
}

// Node 20+는 full-icu가 기본이라 Windows에서도 OS 언어를 반영한다.
// 축소 빌드에서는 'en-US'로 고정되는데, 그때는 영어로 시작하는 것이 맞다.
function intlLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return null
  }
}

export function detectLocale(env = {}, intl = intlLocale()) {
  for (const key of ENV_KEYS) {
    const tag = baseTag(env[key])
    if (tag) return tag
  }
  return baseTag(intl)
}

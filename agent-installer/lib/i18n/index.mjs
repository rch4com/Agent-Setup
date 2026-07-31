// 로케일 해석과 문구 조회. 잎(leaf) 모듈이라 아무것도 import 하지 않는다 —
// args.mjs·context.mjs·bootstrap/*가 전부 여기에 닿으므로, 외부 의존성이
// 하나라도 들어오면 npm install 없이 도는 부트스트랩이 깨진다.
// bootstrap.isolation.test.mjs가 이 불변식을 지킨다.
//
// 전역 싱글턴을 두지 않는다. t는 만들어서 넘기는 값이다 — 그래야 순수
// 모듈(state.mjs)이 계속 아무것도 import 하지 않고, 테스트가 파일 병렬로
// 돌아도 로케일이 서로를 오염시키지 않는다.
import EN from './catalog/en.mjs'
import KO from './catalog/ko.mjs'

export const LOCALES = ['en', 'ko']

const CATALOGS = { en: EN, ko: KO }
const PLACEHOLDER = /\{(\w+)\}/g

// 자리에 값이 없으면 던진다. `12 of undefined files`가 화면에 남는 것보다
// 즉시 실패가 낫다 — 이건 번역 누락이 아니라 호출부의 버그다.
function fill(template, params, key) {
  return template.replace(PLACEHOLDER, (_, name) => {
    if (!Object.hasOwn(params, name)) {
      throw new Error(`i18n: '${key}'의 자리 {${name}}에 값이 없습니다`)
    }
    return String(params[name])
  })
}

// 활성 카탈로그 → 영어 폴백 → 예외.
// 번역 누락은 사용자 화면을 깨뜨리지 않아야 하지만, 영어에도 없는 키는
// 개발자 오타다. 조용히 넘기면 화면에 'log.file.creat'가 그대로 찍힌다.
function lookup(locale, key) {
  const value = CATALOGS[locale]?.[key]
  if (value !== undefined) return value
  const base = EN[key]
  if (base === undefined) throw new Error(`i18n: 알 수 없는 키입니다: ${key}`)
  return base
}

export function createT(locale) {
  const use = LOCALES.includes(locale) ? locale : 'en'
  const t = (key, params = {}) => {
    const value = lookup(use, key)
    return Array.isArray(value)
      ? value.map((line) => fill(line, params, key)).join('\n')
      : fill(value, params, key)
  }
  t.locale = use
  return t
}

// 앞이 이긴다: 플래그 > 환경변수 > 설치 기록 > OS 감지 > 영어.
// 지원하지 않는 값은 조용히 건너뛴다 — 손으로 편집된 기록이나 환경에 남은
// 값 때문에 도구가 죽으면 안 된다. 사용자가 --lang으로 명시한 경우만
// args.mjs가 따로 거부한다.
export function resolveLocale({ flag = null, env = {}, record = null, detected = null } = {}) {
  for (const value of [flag, env.AGENT_SETUP_LANG, record?.lang, detected]) {
    if (typeof value === 'string' && LOCALES.includes(value)) return value
  }
  return 'en'
}

// 플래그나 환경변수가 로케일을 못박았는가. TUI에서 고른 언어는 이번 실행에는
// 적용되지만 기록에만 남고 다음 실행에서 다시 밀리므로, 화면이 그 사실을
// 알려야 한다. 판정 규칙이 resolveLocale과 갈리면 안 되므로 같은 모듈에 둔다 —
// 지원하지 않는 값은 resolveLocale이 이미 건너뛰었고, 셸에 남은
// AGENT_SETUP_LANG=ja까지 "환경변수가 이긴다"고 말하면 거짓말이 된다.
export function isLocaleForced({ flag = null, env = {} } = {}) {
  return [flag, env.AGENT_SETUP_LANG].some((v) => typeof v === 'string' && LOCALES.includes(v))
}

// 옵션 주머니가 없어 t를 꿸 수 없는 곳(context.mjs의 repoPath,
// record.mjs의 readRecord)이 쓴다. .message는 영어로 즉시 채워 스택
// 트레이스가 그대로 읽히게 하고, 진입점이 .key를 보고 다시 렌더한다.
export class LocalizedError extends Error {
  constructor(key, params = {}) {
    super(createT('en')(key, params))
    this.name = 'LocalizedError'
    this.key = key
    this.params = params
  }
}

// 데이터 계층이 만들어 나중에 표시되는 문구용. detect()의 detail이나
// unsupported 사유는 만들어지는 시점에 로케일을 모른다 — 키를 담아 두고
// 렌더 시점에 toText로 푼다.
export function msg(key, params = {}) {
  return { key, params }
}

export function toText(t, value) {
  if (value === null || value === undefined) return value
  return typeof value === 'string' ? value : t(value.key, value.params)
}

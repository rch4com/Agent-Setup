import test from 'node:test'
import assert from 'node:assert/strict'
import { baseTag, detectLocale } from '../lib/i18n/detect.mjs'
import { LOCALES, createT, resolveLocale, LocalizedError, msg, toText } from '../lib/i18n/index.mjs'
import EN from '../lib/i18n/catalog/en.mjs'
import KO from '../lib/i18n/catalog/ko.mjs'
import { LABEL_WIDTH, width } from '../lib/tui/render.mjs'

// ── OS 언어 감지 ──────────────────────────────────────────────────

test('baseTag는 로케일 표기에서 기본 서브태그만 남긴다', () => {
  assert.equal(baseTag('ko_KR.UTF-8'), 'ko')
  assert.equal(baseTag('ko-KR'), 'ko')
  assert.equal(baseTag('en_US'), 'en')
  assert.equal(baseTag('de'), 'de')
  assert.equal(baseTag('en_US:en'), 'en')
})

test('baseTag는 로케일 미지정 값을 null로 본다', () => {
  assert.equal(baseTag('C'), null)
  assert.equal(baseTag('POSIX'), null)
  assert.equal(baseTag('c.UTF-8'), null)
  assert.equal(baseTag(''), null)
  assert.equal(baseTag('   '), null)
  assert.equal(baseTag(undefined), null)
  assert.equal(baseTag(42), null)
})

test('detectLocale은 LC_ALL을 가장 먼저 본다', () => {
  const env = { LC_ALL: 'ko_KR.UTF-8', LC_MESSAGES: 'de_DE', LANG: 'fr_FR' }
  assert.equal(detectLocale(env, 'en-US'), 'ko')
})

test('detectLocale은 환경변수 순서를 지킨다', () => {
  assert.equal(detectLocale({ LC_MESSAGES: 'de_DE', LANG: 'fr_FR' }, 'en-US'), 'de')
  assert.equal(detectLocale({ LANG: 'fr_FR', LANGUAGE: 'ko' }, 'en-US'), 'fr')
  assert.equal(detectLocale({ LANGUAGE: 'ko:en' }, 'en-US'), 'ko')
})

test('detectLocale은 환경변수가 비면 Intl 로케일로 내려간다', () => {
  // Windows에서 실제로 걷는 경로다 — LANG 계열이 비어 있다.
  assert.equal(detectLocale({}, 'ko-KR'), 'ko')
  assert.equal(detectLocale({ LANG: 'C' }, 'ko-KR'), 'ko')
})

test('detectLocale은 아무것도 못 얻으면 null을 돌려준다', () => {
  assert.equal(detectLocale({}, null), null)
  assert.equal(detectLocale({ LANG: 'POSIX' }, ''), null)
})

// ── 카탈로그 구조 ─────────────────────────────────────────────────
//
// 번역 누락은 "어디를 빠뜨렸는지 모른다"가 본질이다. 아래 네 검사가
// 카탈로그 차원의 누락을 전부 잡는다.

const CATALOGS = { en: EN, ko: KO }
const PLACEHOLDER = /\{(\w+)\}/g

function slots(value) {
  const text = Array.isArray(value) ? value.join('\n') : value
  return new Set([...String(text).matchAll(PLACEHOLDER)].map((m) => m[1]))
}

test('모든 로케일이 같은 키 집합을 갖는다', () => {
  const base = Object.keys(EN).sort()
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(CATALOGS[locale]).sort(), base, `${locale} 카탈로그의 키가 다르다`)
  }
})

test('키마다 자리 집합이 로케일 사이에서 같다', () => {
  for (const key of Object.keys(EN)) {
    const want = slots(EN[key])
    for (const locale of LOCALES) {
      assert.deepEqual([...slots(CATALOGS[locale][key])].sort(), [...want].sort(), `${locale}:${key}의 자리가 다르다`)
    }
  }
})

test('키마다 값 타입이 로케일 사이에서 같다', () => {
  for (const key of Object.keys(EN)) {
    for (const locale of LOCALES) {
      assert.equal(Array.isArray(CATALOGS[locale][key]), Array.isArray(EN[key]), `${locale}:${key}의 타입이 다르다`)
    }
  }
})

test('카탈로그 값에 함수를 두지 않는다', () => {
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(CATALOGS[locale])) {
      const ok = typeof value === 'string' || (Array.isArray(value) && value.every((v) => typeof v === 'string'))
      assert.ok(ok, `${locale}:${key}가 문자열도 문자열 배열도 아니다`)
    }
  }
})

test('행 라벨과 탭 이름이 LABEL_WIDTH 안에 든다', () => {
  // 상수 24를 베끼지 않는다 — 두 값이 따로 놀면 규칙이 조용히 무의미해진다.
  for (const locale of LOCALES) {
    const t = createT(locale)
    for (const key of Object.keys(EN)) {
      if (!/^(action\..*\.label|section\.)/.test(key)) continue
      const text = t(key, { current: 'English' })
      assert.ok(width(text) <= LABEL_WIDTH, `${locale}:${key} 폭 ${width(text)} > ${LABEL_WIDTH} — "${text}"`)
    }
  }
})

// ── t ─────────────────────────────────────────────────────────────

test('t는 자리를 채운다', () => {
  const t = createT('en')
  assert.equal(t('locale.en'), 'English')
  assert.equal(t('error.notGitRepo'), 'Run this inside a Git repository.')
})

test('t는 모르는 키에 던진다', () => {
  const t = createT('en')
  assert.throws(() => t('nope.not.here'), /nope\.not\.here/)
})

test('t는 자리에 값이 없으면 던진다', () => {
  const t = createT('en')
  assert.throws(() => t('error.pathOutsideRepo', {}), /\{path\}/)
})

test('t는 활성 카탈로그에 없는 키를 영어로 폴백한다', () => {
  const t = createT('ko')
  const saved = KO['locale.en']
  delete KO['locale.en']
  try {
    assert.equal(t('locale.en'), EN['locale.en'])
  } finally {
    KO['locale.en'] = saved
  }
})

test('t.locale은 실제로 쓰이는 로케일이다', () => {
  assert.equal(createT('ko').locale, 'ko')
  assert.equal(createT('sw').locale, 'en')
})

// ── resolveLocale ─────────────────────────────────────────────────

test('resolveLocale은 플래그 > 환경변수 > 기록 > 감지 순으로 고른다', () => {
  const all = { flag: 'ko', env: { AGENT_SETUP_LANG: 'en' }, record: { lang: 'en' }, detected: 'en' }
  assert.equal(resolveLocale(all), 'ko')
  assert.equal(resolveLocale({ ...all, flag: null }), 'en')
  assert.equal(resolveLocale({ flag: null, env: {}, record: { lang: 'ko' }, detected: 'en' }), 'ko')
  assert.equal(resolveLocale({ flag: null, env: {}, record: null, detected: 'ko' }), 'ko')
})

test('resolveLocale은 지원하지 않는 값을 건너뛴다', () => {
  // 손으로 편집된 기록이나 환경에 남은 값 때문에 도구가 죽으면 안 된다.
  assert.equal(resolveLocale({ env: { AGENT_SETUP_LANG: 'de' }, record: { lang: 'ko' } }), 'ko')
  assert.equal(resolveLocale({ record: { lang: 'zz' }, detected: 'fr' }), 'en')
  assert.equal(resolveLocale({}), 'en')
})

// ── LocalizedError · msg ──────────────────────────────────────────

test('LocalizedError는 영어 메시지와 키를 함께 갖는다', () => {
  const err = new LocalizedError('error.pathOutsideRepo', { path: '/tmp/x' })
  assert.equal(err.key, 'error.pathOutsideRepo')
  assert.deepEqual(err.params, { path: '/tmp/x' })
  assert.equal(err.message, createT('en')('error.pathOutsideRepo', { path: '/tmp/x' }))
  assert.ok(err instanceof Error)
})

test('toText는 구조화 메시지만 번역하고 문자열은 그대로 둔다', () => {
  const t = createT('ko')
  assert.equal(toText(t, msg('locale.en')), 'English')
  assert.equal(toText(t, '이미 문자열'), '이미 문자열')
  assert.equal(toText(t, null), null)
  assert.equal(toText(t, undefined), undefined)
})

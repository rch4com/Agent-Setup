// 터미널 표시 폭 계산. TUI 화면과 비대화형 목록이 함께 쓴다.
//
// 아무것도 import 하지 않는다 — install.mjs가 정적으로 끌어오므로
// bootstrap.isolation.test.mjs가 이 파일까지 의존성 0을 요구한다. 그리고
// design-md/flow.mjs도 여기에 닿는데, 이 함수들이 tui/render.mjs에 남아
// 있으면 render → flow → render 순환 import가 된다.
//
// String.padEnd는 코드 유닛을 센다. 한글 한 글자가 두 칸을 차지하는 터미널에서
// padEnd로 열을 맞추면 로케일이 바뀔 때마다 열이 어긋난다 — 그래서 폭 계산은
// 화면이든 목록이든 전부 이 모듈을 거친다.

// 동아시아 글자는 터미널에서 두 칸을 차지한다. 전체 wcwidth 표 대신
// 실제로 쓰이는 구간(한글·한자·가나·전각)만 넓게 센다.
function charWidth(cp) {
  return (cp >= 0x1100 && cp <= 0x115f) // 한글 자모
    || (cp >= 0x2e80 && cp <= 0xa4cf) // 한자 부수·가나·한자
    || (cp >= 0xac00 && cp <= 0xd7a3) // 한글 음절
    || (cp >= 0xf900 && cp <= 0xfaff) // 한자 호환
    || (cp >= 0xfe30 && cp <= 0xfe6f) // 전각 형태
    || (cp >= 0xff00 && cp <= 0xff60) // 전각 영숫자
    || (cp >= 0xffe0 && cp <= 0xffe6)
    ? 2 : 1
}

export function width(text) {
  let w = 0
  for (const ch of String(text ?? '')) w += charWidth(ch.codePointAt(0))
  return w
}

// 색 코드는 폭에 포함되면 안 되므로, 자르기는 항상 색을 입히기 **전에** 한다.
export function cut(text, limit) {
  if (limit <= 0) return ''
  const s = String(text ?? '')
  if (width(s) <= limit) return s
  let out = ''
  let w = 0
  for (const ch of s) {
    const cw = charWidth(ch.codePointAt(0))
    if (w + cw > limit - 1) break
    out += ch
    w += cw
  }
  return `${out}…`
}

export function pad(text, limit) {
  const s = cut(text, limit)
  return s + ' '.repeat(Math.max(0, limit - width(s)))
}

// 상태 라벨은 로케일마다 길이가 다르다(영어 'Not installed' 13, 한국어
// '미설치' 6). 한 번 재어 상수로 박으면 다른 로케일에서 열이 깨지므로,
// 화면을 그릴 때 그 로케일의 실제 라벨에서 폭을 뽑는다.
export function labelWidth(t, keys) {
  return Math.max(...keys.map((key) => width(t(key))))
}

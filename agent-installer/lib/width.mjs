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

// 접기. cut은 넘치는 글을 버리고 pad는 모자란 폭을 채우지만, 상세 패널과
// 진행 화면은 넘치는 글을 다음 줄로 이어 가야 한다.
//
// 공백이 있으면 마지막 공백에서 끊고(영문), 한 낱말이 limit보다 길거나
// 공백이 없으면(한글) 표시 폭에서 끊는다. limit이 0 이하면 빈 배열을
// 돌려준다 — 호출부가 폭을 잘못 계산했을 때 무한 루프에 빠지지 않게 한다.
//
// 문자 하나의 표시 폭이 limit보다 넓으면 그 문자를 버린다. limit < 2에서는
// 폭을 지키면서 동시에 모든 문자를 담을 수 없다. 폭을 넘기면 TUI 레이아웃이
// 무너지지만, 버리면 내용만 손실된다. 따라서 폭 불변식을 택했다.
export function wrap(text, limit) {
  const s = String(text ?? '')
  if (limit <= 0 || s === '') return []
  const out = []
  for (const para of s.split('\n')) {
    let line = ''
    let w = 0
    let breakAt = -1 // line 안에서 마지막으로 본 공백의 위치
    for (const ch of para) {
      const cw = charWidth(ch.codePointAt(0))
      // 공백을 먼저 기록한다. 이렇게 해야 가장 최근의 공백을 추적할 수 있다.
      // 뒤에 아직 추가될 문자들이 있어도, 그 공백이 overflow가 되지 않으면
      // breakAt으로 유지되고, 되면 그 공백에서 끊을 준비가 된다.
      if (ch === ' ') breakAt = line.length
      if (w + cw > limit) {
        // Overflow: line이 limit을 초과할 것이다.
        if (breakAt > 0) {
          // 이전에 공백을 본 적이 있다. 그 공백에서 끊는다.
          out.push(line.slice(0, breakAt))
          line = line.slice(breakAt + 1)
        } else {
          // 공백이 없다. 현재 line을 그대로 끊는다.
          // 단, 현재 line이 비어있으면 빈 항목을 만들지 않는다.
          if (line) out.push(line)
          line = ''
        }
        w = width(line)
        breakAt = -1
        // Overflow를 유발한 공백은 버린다. 그 공백은 이미 line을 초과시켰으므로
        // 다음 줄에 포함하면 불필요한 공백이 앞에 붙는다.
        if (ch === ' ') continue
      }
      // Overflow가 아니라면, 또는 처리 후라면, 문자를 추가한다.
      // 단, 현재 line이 비어있는데 그 문자 자체가 limit보다 넓으면 건너뛴다.
      // 호출부가 폭을 잘못 계산해도 이 함수가 limit을 지키기 위함이다.
      if (w === 0 && cw > limit) {
        continue
      }
      line += ch
      w += cw
    }
    // 이번 문단을 끝낸다. 문단이 비어있거나 line이 비어있지 않으면 추가한다.
    // 이렇게 해서 "접힘 자리의 공백 때문에 빈 줄이 생기는" 문제를 피한다.
    if (line || para === '') out.push(line)
  }
  return out
}

// 상태 라벨은 로케일마다 길이가 다르다(영어 'Not installed' 13, 한국어
// '미설치' 6). 한 번 재어 상수로 박으면 다른 로케일에서 열이 깨지므로,
// 화면을 그릴 때 그 로케일의 실제 라벨에서 폭을 뽑는다.
export function labelWidth(t, keys) {
  return Math.max(...keys.map((key) => width(t(key))))
}

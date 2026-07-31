import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { itemRows, makeTempRepo, nameColumn, runInstaller, KO } from './helpers.mjs'

// i18n.en.test.mjs는 한 방향만 본다: "영어 출력에 한글이 남았는가."
// 그 반대 방향 — 한국어 출력에 영어 리터럴이 새어 나가는 것 — 은 아무도
// 보지 않았고, 그래서 writeRecord의 `record: {path}` 폴백이 한국어 출력
// 한가운데에서 한 줄을 영어로 찍는 채로 배포됐다. 이 파일이 그 구멍이다.

const HANGUL = /[가-힣]/
const PREFIX = '[agent-setup] '

// 규칙: `[agent-setup] ` 접두사를 뗀 **메시지**가 공백으로 시작하지 않으면
// 그것은 우리가 쓴 문장이고, 한국어 로케일에서는 한글을 하나 이상 담아야 한다.
//
// 메시지만 본다 — 접두사 자체가 ASCII이므로 줄 전체를 보면 규칙이 성립하지 않는다.
// 문장 안에 ASCII가 섞이는 것은 정상이다: 경로(.vscode/mcp.json), 도구 이름
// (Claude Code, Grok Build), 버전(1.1.0)은 본래 ASCII다. 그래서 "ASCII로
// 시작하지 않는가"가 아니라 "한글이 하나라도 있는가"를 본다 — 그 셋은 전부
// 한국어 서술어와 함께 나오므로 통과하고, 서술어가 통째로 영어인 줄만 걸린다.
//
// 면제: 메시지가 공백으로 시작하는 줄. 들여쓴 줄은 문장이 아니라 자료 행이다
// (update의 드리프트 목록이 `  {경로} — {사유}`를 그렇게 찍는다). 경로만 있는
// 행에 한글을 요구하면 거짓 실패가 된다.
function assertKoreanMessages(stdout, what) {
  for (const line of stdout.split('\n')) {
    if (!line.startsWith(PREFIX)) continue
    const message = line.slice(PREFIX.length)
    if (message === '' || message.startsWith(' ')) continue
    assert.ok(HANGUL.test(message), `${what}: 한국어 자리에 영어 문장이 남았습니다 — ${line}`)
  }
}

test('한국어 bootstrap 출력에 영어 문장이 없다', () => {
  const root = makeTempRepo()
  const first = runInstaller(root, ['bootstrap'], { env: KO })
  assert.equal(first.status, 0, first.stderr)
  assertKoreanMessages(first.stdout, 'bootstrap 1회차')

  // 2회차는 "기존 파일 유지"·"관리 블록 확인" 같은 멱등 분기를 밟는다 —
  // 영어 스위트가 두 번 도는 것과 같은 이유다.
  const second = runInstaller(root, ['bootstrap'], { env: KO })
  assert.equal(second.status, 0, second.stderr)
  assertKoreanMessages(second.stdout, 'bootstrap 2회차')
})

// update는 dry-run이 아닐 때만 기록을 쓴다 — writeRecord의 영어 폴백은
// 실제 실행에서만 드러났다.
//
// 관리 파일을 하나 고쳐 두고 돌린다. 드리프트 목록은 경로만 있는 자료 행이라
// 위 규칙의 면제 대상인데, 드리프트가 없으면 그 면제가 한 번도 실행되지 않아
// 규칙이 맞는지 알 수 없다.
test('한국어 update 출력에 영어 문장이 없다', () => {
  const root = makeTempRepo()
  assert.equal(runInstaller(root, ['bootstrap'], { env: KO }).status, 0)
  const managed = join(root, 'AGENTS.md')
  writeFileSync(managed, `${readFileSync(managed, 'utf8')}\n사용자가 고친 줄\n`)

  const r = runInstaller(root, ['update'], { env: KO })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /설치 기록 기록/, '기록 갱신 줄이 아예 찍히지 않았다')
  // 접두사 뒤 공백 1칸 + 자료 행 들여쓰기 2칸 = 3칸. 이 행이 위 규칙의 면제 대상이다.
  assert.match(r.stdout, /^\[agent-setup] {3}AGENTS\.md$/m, '드리프트 자료 행이 나오지 않았다')
  assertKoreanMessages(r.stdout, 'update')
})

// 한국어 상태 라벨은 '설치됨'·'미설치'가 6칸, '일부 설치됨'이 11칸으로 갈린다.
// padEnd는 코드 유닛을 세므로 앞의 둘은 넉넉히, 뒤의 하나는 2칸 모자라게
// 채워져 항목 열이 어긋났다. 세 라벨이 한 화면에 같이 나와야 드러난다.
test('한국어 --list는 상태가 섞여도 항목 열이 맞는다', () => {
  const root = makeTempRepo()
  assert.equal(runInstaller(root, ['bootstrap'], { env: KO }).status, 0)
  assert.equal(runInstaller(root, ['--set', 'mcp.notion,mcp.vercel'], { env: KO }).status, 0)
  // 한 CLI에서 notion만 빼면 notion은 '일부 설치됨', vercel은 '설치됨',
  // 나머지는 '미설치'가 되어 세 라벨이 한 화면에 모인다.
  const settings = join(root, '.gemini', 'settings.json')
  const parsed = JSON.parse(readFileSync(settings, 'utf8'))
  delete parsed.mcpServers.notion
  writeFileSync(settings, `${JSON.stringify(parsed, null, 2)}\n`)

  const r = runInstaller(root, ['--list'], { env: KO })
  assert.equal(r.status, 0, r.stderr)

  const rows = ['설치됨', '일부 설치됨', '미설치'].map((label) => itemRows(r.stdout, label))
  for (const [i, group] of rows.entries()) {
    assert.ok(group.length > 0, `상태가 세 종류 다 나오지 않았다 (${i}번째가 비었다)`)
  }
  const columns = new Set(rows.flat().map(nameColumn))
  assert.equal(columns.size, 1, `항목 열이 행마다 다른 칸에서 시작한다: ${[...columns].join(', ')}`)
})

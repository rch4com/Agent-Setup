// 정규화와 해시의 단일 출처.
//
// 파일을 쓸 때와 "우리가 쓴 그대로인가"를 판정할 때 같은 정규화를 써야 한다.
// 둘이 갈리면 갓 쓴 파일조차 드리프트로 보고된다. 그래서 이 모듈을 최하위에
// 두고 apply.mjs(쓰기)와 record.mjs(판정)가 함께 import한다 — 한쪽에만
// 정규화 규칙을 두면 두 모듈이 서로를 import하는 순환이 생긴다.
//
// 부트스트랩 그래프에 속하므로 node: 내장 모듈만 쓴다.
import { createHash } from 'node:crypto'

// 두 OS가 같은 파일을 만들도록 항상 LF + 끝 개행 1개로 정규화한다.
export function normalizeBody(text) {
  return text.replace(/\r\n/g, '\n').trim() + '\n'
}

// 정규화한 내용의 해시. 워킹트리 줄바꿈이 CRLF든 LF든 같은 값이 나온다.
export function hashBody(text) {
  return `sha256:${createHash('sha256').update(normalizeBody(text), 'utf8').digest('hex')}`
}

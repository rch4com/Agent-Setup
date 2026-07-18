import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function importsOf(file) {
  const text = readFileSync(file, 'utf8')
  // 정적 import만 본다. 동적 import()는 분기 안에서만 실행되므로 대상이 아니다.
  return [...text.matchAll(/^\s*import\s(?:[^'"]*\sfrom\s)?['"]([^'"]+)['"]/gm)].map((m) => m[1])
}

// 지정한 진입점에서 정적 import로 도달 가능한 모든 파일을 모은다.
function reachable(entry) {
  const seen = new Set()
  const queue = [resolve(entry)]
  const bare = []

  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)

    for (const spec of importsOf(file)) {
      if (spec.startsWith('node:')) continue
      if (spec.startsWith('.')) {
        queue.push(resolve(dirname(file), spec))
        continue
      }
      bare.push({ file: file.slice(ROOT.length + 1), spec })
    }
  }
  return { files: seen, bare }
}

// npm install 없이 부트스트랩이 돌아야 한다. 이 불변식은 최상위 import 한 줄로
// 조용히 깨지고, 깨진 사실은 node_modules가 없는 환경에서만 드러난다.
test('부트스트랩 모듈 그래프에 외부 의존성이 없다', () => {
  const { bare } = reachable(join(ROOT, 'lib', 'bootstrap', 'flow.mjs'))
  assert.deepEqual(bare, [], `외부 의존성 유입: ${JSON.stringify(bare)}`)
})

test('context.mjs에 외부 의존성이 없다', () => {
  const { bare } = reachable(join(ROOT, 'lib', 'context.mjs'))
  assert.deepEqual(bare, [])
})

test('install.mjs의 정적 import가 부트스트랩 경로만 끌어온다', () => {
  const { bare } = reachable(join(ROOT, 'install.mjs'))
  assert.deepEqual(bare, [], `install.mjs 최상위에서 의존성 유입: ${JSON.stringify(bare)}`)
})

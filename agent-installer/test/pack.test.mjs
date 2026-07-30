import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Windows에서 npm은 npm.cmd다. Node 20은 .cmd를 shell 없이 실행하면
// EINVAL로 거부하므로(CVE-2024-27980 대응) 그 플랫폼에서만 shell을 켠다.
// 인자에 공백·따옴표가 없어 shell 경유가 안전하다.
const USE_SHELL = process.platform === 'win32'

// npm pack 한 번이 수 초 걸리므로 결과를 재사용한다.
let cached
function packInfo() {
  if (!cached) {
    const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: PKG_ROOT,
      encoding: 'utf8',
      shell: USE_SHELL,
      // npm은 notice를 stderr로 보낸다. JSON만 읽으려면 분리해야 한다.
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    cached = JSON.parse(out)[0]
  }
  return cached
}

// npm이 무조건 넣는 package.json과 files 화이트리스트의 합집합이다.
const ALLOWED_TOP = new Set(['install.mjs', 'lib', 'package.json', 'README.md', 'LICENSE'])

test('tarball 최상위에 허용되지 않은 경로가 없다', () => {
  const tops = [...new Set(packInfo().files.map((f) => f.path.split('/')[0]))]
  const unexpected = tops.filter((t) => !ALLOWED_TOP.has(t))
  assert.deepEqual(unexpected, [], `예상 밖 경로가 발행된다: ${unexpected.join(', ')}`)
})

test('테스트와 유지보수 스크립트는 발행되지 않는다', () => {
  const paths = packInfo().files.map((f) => f.path)
  for (const prefix of ['test/', 'scripts/', 'node_modules/']) {
    const leaked = paths.filter((p) => p.startsWith(prefix))
    assert.deepEqual(leaked, [], `${prefix}가 tarball에 들어간다`)
  }
})

test('DESIGN.md 오프라인 번들이 함께 발행된다', () => {
  const bundled = packInfo().files.filter((f) => f.path.startsWith('lib/design-md/cache/'))
  // 번들은 76개다. 하한을 두어 화이트리스트 실수로 통째 빠지는 것을 잡는다.
  assert.ok(bundled.length >= 70, `번들 DESIGN.md가 ${bundled.length}개뿐이다`)
})

test('tarball이 2MiB 미만이다', () => {
  const { size } = packInfo()
  // 실측 0.58MB. 번들이 커져 npx 첫 실행이 느려지면 조용히 통과하지 않게 한다.
  assert.ok(size < 2 * 1024 * 1024, `tarball이 ${(size / 1024 / 1024).toFixed(2)}MB다 — 번들 분리를 검토하라`)
})

test('bin 이름이 패키지 이름과 같다', () => {
  // 달라지면 npx agent-setup이 동작하지 않는다.
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'))
  assert.deepEqual(Object.keys(pkg.bin), ['agent-setup'])
  assert.equal(pkg.bin['agent-setup'], 'install.mjs')
  assert.equal(pkg.name, 'agent-setup')
})

test('발행을 막는 필드가 없다', () => {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'))
  assert.equal(pkg.private, undefined, 'private: true면 발행되지 않는다')
  assert.match(pkg.version, /^\d+\.\d+\.\d+/)
  assert.equal(pkg.license, 'MIT')
})

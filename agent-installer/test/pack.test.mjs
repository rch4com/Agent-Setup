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

// files에 나열된 경로는 .gitignore보다 우선한다 — lib/를 넣으면 그 아래
// 전부가 gitignore 여부와 무관하게 포함된다. 실제로 도구가 만든
// lib/items/.omc/... 세션 상태 파일이 1.0.0에 그대로 실려 나갔다.
// 최상위 화이트리스트만으로는 lib/ 하위에 낀 이물질을 잡을 수 없다.
test('숨은 디렉터리·파일이 섞여 나가지 않는다', () => {
  const dotted = packInfo().files
    .map((f) => f.path)
    .filter((p) => p.split('/').some((seg) => seg.startsWith('.')))
  assert.deepEqual(dotted, [], `숨은 경로가 발행된다: ${dotted.join(', ')}`)
})

test('소스·문서 확장자만 발행된다', () => {
  const ALLOWED_EXT = new Set(['.mjs', '.json', '.md'])
  const ALLOWED_EXACT = new Set(['LICENSE'])
  const strays = packInfo().files
    .map((f) => f.path)
    .filter((p) => !ALLOWED_EXACT.has(p))
    .filter((p) => !ALLOWED_EXT.has(p.slice(p.lastIndexOf('.'))))
  assert.deepEqual(strays, [], `예상 밖 확장자가 발행된다: ${strays.join(', ')}`)
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

test('스코프 패키지 이름과 실행 명령 이름', () => {
  // 정식 이름 agent-setup은 npm의 유사 이름 제한에 걸린다 — 기존 패키지
  // agentsetup과 정규화하면 같아져 403으로 거부된다. 스코프 이름만 쓴다.
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'))
  assert.equal(pkg.name, '@rch4com/agent-setup')

  // 스코프 이름은 셸 명령이 될 수 없으므로 bin 이름은 짧게 둔다. bin이
  // 하나뿐이라 npx @rch4com/agent-setup이 그대로 이것을 실행한다.
  assert.deepEqual(Object.keys(pkg.bin), ['agent-setup'])
  assert.equal(pkg.bin['agent-setup'], 'install.mjs')
})

test('발행을 막는 필드가 없다', () => {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'))
  assert.equal(pkg.private, undefined, 'private: true면 발행되지 않는다')
  assert.match(pkg.version, /^\d+\.\d+\.\d+/)
  assert.equal(pkg.license, 'MIT')
  // 스코프 패키지는 기본이 restricted다. 이 값이 없으면 아무도 설치할 수 없다.
  assert.equal(pkg.publishConfig?.access, 'public')
})

test('루트 LICENSE와 패키지 LICENSE가 동일하다', () => {
  // files가 패키지 디렉터리 밖에 닿을 수 없어 사본이 불가피하다.
  // 갈라지면 발행된 라이선스와 저장소 라이선스가 달라진다.
  const norm = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
  const inPackage = norm(join(PKG_ROOT, 'LICENSE'))
  const atRoot = norm(join(PKG_ROOT, '..', 'LICENSE'))
  assert.equal(inPackage, atRoot)
  assert.match(inPackage, /^MIT License/)
})

test('LICENSE가 tarball에 들어간다', () => {
  const paths = packInfo().files.map((f) => f.path)
  assert.ok(paths.includes('LICENSE'), 'LICENSE가 발행되지 않는다')
})

test('README가 tarball에 들어가고 npx 사용법을 담는다', () => {
  const paths = packInfo().files.map((f) => f.path)
  assert.ok(paths.includes('README.md'), 'README.md가 발행되지 않는다')

  // npm 페이지의 첫 화면이다. 설치 방법이 없으면 페이지가 무의미하다.
  const readme = readFileSync(join(PKG_ROOT, 'README.md'), 'utf8')
  assert.match(readme, /npx @rch4com\/agent-setup/)
  // 상세 문서로 가는 길이 끊기면 짧게 쓴 의미가 없다.
  assert.match(readme, /github\.com\/rch4com\/Agent-Setup/)
})

test('설치 기록은 발행되지 않는다', () => {
  // .agent-kit은 소비 저장소가 만드는 것이지 패키지에 담는 것이 아니다.
  const paths = packInfo().files.map((f) => f.path)
  assert.deepEqual(paths.filter((p) => p.startsWith('.agent-kit')), [])
})

# npx 발행 1단계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `agent-installer/`를 `agent-setup`과 `@rch4com/agent-setup` 두 이름으로 npm에 발행해, 다른 저장소가 파일을 복사하지 않고 `npx agent-setup bootstrap` 한 줄로 배선하게 만든다.

**Architecture:** 발행 루트는 `agent-installer/`다. 이미 자기완결이라 코드를 옮기지 않고 `package.json`에 발행 메타데이터만 채운다. 무엇이 tarball에 들어가는지는 사람 눈이 아니라 `npm pack --dry-run --json`을 읽는 테스트가 지킨다. 태그 푸시를 받은 GitHub Actions가 `name`만 바꿔 두 번 publish한다. CLI 명령은 이 단계에서 **바꾸지 않는다** — 기존 `bootstrap`·`--list`·`--set`·`design`이 그대로 동작한다.

**Tech Stack:** Node.js 20+, ESM(`type: module`), `node --test`, npm 발행(`--provenance`), GitHub Actions.

**설계 문서:** `docs/superpowers/specs/2026-07-30-npx-distribution-design.md`

**이 계획의 범위:** 스펙 3단계 중 **1단계만** 다룬다. 2단계(설치 기록·갱신 엔진)와 3단계(명령 전면 재편)는 각자 별도 계획으로 쓴다 — 1단계가 발행 채널을 열어 놓아야 그 위에서 반복할 수 있고, 2·3단계 계획을 지금 쓰면 1단계 구현에서 나올 결정을 추측하게 된다.

## Global Constraints

- Node.js **20 이상**. `package.json`의 `engines.node`는 `>=20`을 유지한다.
- ESM 전용이다. `require`를 새로 쓰지 않는다(`type: "module"`).
- **부트스트랩 모듈 그래프의 외부 의존성은 0이다.** `test/bootstrap.isolation.test.mjs`가 강제한다. 이 단계에서 부트스트랩 코드를 건드리지 않으므로 그대로 통과해야 한다.
- 프로덕션 의존성을 추가하지 않는다(`AGENTS.md` 규칙). 현재 `jsonc-parser`, `smol-toml` 둘뿐이며 늘리지 않는다.
- 테스트는 `node --test`이고 파일명은 `test/*.test.mjs`다. 그 밖의 러너·어서션 라이브러리를 도입하지 않는다.
- 텍스트를 비교할 때는 **반드시 `\r\n` → `\n` 정규화 후** 비교한다. `.gitattributes:9`가 `* text=auto`라 워킹트리 줄바꿈이 플랫폼마다 다르다.
- Windows에서 `npm`을 자식 프로세스로 부를 때는 **`shell: true`를 켠다.** Node 20은 `.cmd`를 shell 없이 실행하면 EINVAL로 거부한다(CVE-2024-27980 대응). 명령 이름을 `npm.cmd`로 바꾸는 것만으로는 **해결되지 않는다** — 실측으로 확인했다.
- 저장소 루트 밖에 쓰지 않는다.
- 코드 주석은 한국어로 쓰고, **무엇을 하는지가 아니라 왜 그렇게 하는지**를 적는다(기존 코드 관행).
- 커밋 메시지는 `.gitmessage.txt` 템플릿을 따른다 — `<type>(<scope>): <subject>`, 타입은 영어 소문자 키워드, 제목·본문은 한국어, 제목 50자 이내 마침표 없음, 본문 72자 이내.
- 발행 이름은 `agent-setup`(정식)과 `@rch4com/agent-setup`(스코프)이며 **내용은 완전히 동일**하다.
- 이 단계의 발행 버전은 **`1.0.0`**이다.

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `agent-installer/package.json` | 발행 메타데이터 — 이름·버전·`bin`·`files` 화이트리스트 | 수정 |
| `agent-installer/test/pack.test.mjs` | tarball 내용물 계약을 지킨다. 발행은 되돌릴 수 없으므로 사람 검토에 맡기지 않는다 | 신규 |
| `LICENSE` | GitHub가 읽는 라이선스 | 신규 |
| `agent-installer/LICENSE` | npm tarball에 들어가는 라이선스. `files`가 패키지 디렉터리 밖에 닿을 수 없어 사본이 필요하다 | 신규 |
| `agent-installer/README.md` | npm 패키지 페이지에 뜨는 문서. 설치·명령·링크만 담고 상세는 GitHub로 링크한다 | 신규 |
| `.github/workflows/publish.yml` | 태그 푸시 → 검증 → 이중 발행 | 신규 |
| `README.md` | 저장소 첫 화면의 빠른 시작을 npx로 | 수정 |
| `AgentSetup-README.md` | 설치 절을 npx 기준으로, "팀 저장소에 넣을 파일"에서 벤더링 제거 | 수정 |
| `AgentSetup-README-CHANGES.md` | 변경 이력 항목 추가 | 수정 |

`pack.test.mjs`를 `install.cli.test.mjs`에 합치지 않는 이유: 검증 대상이 CLI 동작이 아니라 **패키징 계약**이고, 실패했을 때 읽어야 할 곳이 `package.json`이지 코드가 아니다. 파일이 따로 있어야 실패 원인이 파일명에서 드러난다.

---

## Task 1: 발행 메타데이터와 pack 목록 검증

`npm pack`은 현재 `Invalid package, must have name and version`으로 실패한다 — `package.json`에 `version` 필드가 없다. 테스트를 먼저 써서 이 실패를 확인하고, 메타데이터를 채워 통과시킨다.

**Files:**
- Create: `agent-installer/test/pack.test.mjs`
- Modify: `agent-installer/package.json`

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces: `agent-installer/package.json`의 확정된 `files` 화이트리스트 `["install.mjs", "lib/", "README.md", "LICENSE"]`. Task 2·3이 이 목록에 맞춰 `LICENSE`와 `README.md`를 **`agent-installer/` 안에** 만든다. `bin` 이름은 `agent-setup`이며 Task 4·5의 문서·워크플로가 이 이름을 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/pack.test.mjs`:

```js
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
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd agent-installer && node --test "test/pack.test.mjs"`

Expected: FAIL. `npm pack`이 `Invalid package, must have name and version`으로 죽어 `packInfo()`가 예외를 던지고, `bin`·`private`·`license` 검사도 함께 실패한다.

- [ ] **Step 3: package.json에 발행 메타데이터를 채운다**

`agent-installer/package.json` 전체를 이 내용으로 바꾼다:

```json
{
  "name": "agent-setup",
  "version": "1.0.0",
  "description": "여러 코딩 에이전트 CLI를 한 저장소에서 함께 쓰기 위한 저장소 범위 부트스트랩과 선택 항목 설치기",
  "keywords": [
    "agents-md",
    "claude-code",
    "codex",
    "gemini-cli",
    "copilot",
    "mcp",
    "agent-skills"
  ],
  "homepage": "https://github.com/rch4com/Agent-Setup#readme",
  "bugs": "https://github.com/rch4com/Agent-Setup/issues",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/rch4com/Agent-Setup.git",
    "directory": "agent-installer"
  },
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": { "agent-setup": "install.mjs" },
  "files": ["install.mjs", "lib/", "README.md", "LICENSE"],
  "scripts": {
    "start": "node install.mjs",
    "test": "node --test \"test/*.test.mjs\"",
    "refresh-bundle": "node scripts/refresh-bundle.mjs"
  },
  "dependencies": {
    "jsonc-parser": "^3.3.1",
    "smol-toml": "^1.3.1"
  }
}
```

`private: true`가 사라졌고 `version`·`bin`·`files`·`license`·`repository`가 추가됐다. 의존성은 그대로다.

`scripts`의 `test`와 `refresh-bundle`은 `test/`·`scripts/`가 발행되지 않으므로 **설치된 패키지에서는 동작하지 않는다.** 이건 의도한 것이다 — 유지보수자용 스크립트이고, 발행 패키지에서 실행하는 것은 지원 대상이 아니다. 이 항목을 "고치려고" `files`에 `test/`나 `scripts/`를 넣지 마라. pack 테스트가 거부한다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `cd agent-installer && node --test "test/pack.test.mjs"`

Expected: PASS 6건. `bin 이름이 패키지 이름과 같다`와 `발행을 막는 필드가 없다`는 통과하고, tarball 관련 4건도 통과한다. `README.md`·`LICENSE`는 아직 없지만 `files`에 없는 파일은 npm이 조용히 건너뛰므로 실패하지 않는다.

- [ ] **Step 5: 전체 테스트로 회귀를 확인한다**

Run: `cd agent-installer && npm test`

Expected: 기존 테스트 전부 PASS. 특히 `bootstrap.isolation.test.mjs`가 통과해야 한다 — `package.json`을 고쳤을 뿐 부트스트랩 모듈 그래프는 건드리지 않았다.

- [ ] **Step 6: 커밋**

```bash
git add agent-installer/package.json agent-installer/test/pack.test.mjs
git commit -F- <<'EOF'
feat(installer): npm 발행 메타데이터와 pack 목록 검증 추가

version 필드가 없어 npm pack 자체가 실패하던 상태를 고치고,
bin·files·license·repository를 채워 발행 가능하게 만든다.

발행은 되돌릴 수 없으므로 tarball 내용물을 사람 검토가 아니라
테스트가 지킨다 — 최상위 경로 화이트리스트, test/·scripts/
누출 금지, DESIGN.md 번들 존재, 2MiB 상한을 검사한다.
EOF
```

---

## Task 2: MIT 라이선스

`files`에 `LICENSE`를 선언했으므로 `agent-installer/LICENSE`가 있어야 tarball에 들어간다. GitHub는 저장소 루트를 보므로 루트에도 필요하다. `files`는 패키지 디렉터리 밖에 닿을 수 없어 사본이 불가피하고, 두 파일이 갈라지지 않게 테스트로 묶는다.

**Files:**
- Create: `LICENSE`
- Create: `agent-installer/LICENSE`
- Modify: `agent-installer/test/pack.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `files` 화이트리스트에 이미 `"LICENSE"`가 있다. `package.json`의 `license` 필드는 `"MIT"`다.
- Produces: 없음 (다른 작업이 참조하지 않는다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/pack.test.mjs` 끝에 추가한다:

```js
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
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd agent-installer && node --test "test/pack.test.mjs"`

Expected: FAIL 2건. `ENOENT: no such file or directory ... LICENSE`와 `LICENSE가 발행되지 않는다`.

- [ ] **Step 3: LICENSE를 만든다**

`LICENSE` (저장소 루트):

```text
MIT License

Copyright (c) 2026 rch4com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

같은 내용을 `agent-installer/LICENSE`로 복사한다.

```bash
cp LICENSE agent-installer/LICENSE
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `cd agent-installer && node --test "test/pack.test.mjs"`

Expected: PASS 8건.

- [ ] **Step 5: 커밋**

```bash
git add LICENSE agent-installer/LICENSE agent-installer/test/pack.test.mjs
git commit -F- <<'EOF'
add: MIT 라이선스

npm 발행과 공개 저장소에 라이선스가 필요하다. files가 패키지
디렉터리 밖에 닿을 수 없어 사본이 불가피하므로, 두 파일이
갈라지지 않도록 동일성을 테스트로 묶는다.
EOF
```

---

## Task 3: npm 페이지용 README

npm 패키지 페이지에 뜨는 것은 `agent-installer/README.md`인데 현재 없다. 23KB짜리 `AgentSetup-README.md`를 복사하면 두 벌 관리가 되므로 짧게 쓰고 상세는 GitHub로 링크한다.

**Files:**
- Create: `agent-installer/README.md`
- Modify: `agent-installer/test/pack.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `bin` 이름 `agent-setup`. 이 단계의 CLI 명령은 아직 `bootstrap`·`--list`·`--set`·`design`이다.
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/pack.test.mjs` 끝에 추가한다:

```js
test('README가 tarball에 들어가고 npx 사용법을 담는다', () => {
  const paths = packInfo().files.map((f) => f.path)
  assert.ok(paths.includes('README.md'), 'README.md가 발행되지 않는다')

  // npm 페이지의 첫 화면이다. 설치 방법이 없으면 페이지가 무의미하다.
  const readme = readFileSync(join(PKG_ROOT, 'README.md'), 'utf8')
  assert.match(readme, /npx agent-setup/)
  // 상세 문서로 가는 길이 끊기면 짧게 쓴 의미가 없다.
  assert.match(readme, /github\.com\/rch4com\/Agent-Setup/)
})
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd agent-installer && node --test "test/pack.test.mjs"`

Expected: FAIL. `README.md가 발행되지 않는다`.

- [ ] **Step 3: README를 쓴다**

`agent-installer/README.md`:

````markdown
# agent-setup

Claude Code, Codex, Gemini CLI, OpenCode, Kilo Code, Kiro, Kimi Code,
Grok Build, Antigravity, GitHub Copilot CLI, VS Code Copilot을 **한 저장소에서
함께** 쓰기 위한 저장소 범위 부트스트랩과 선택 항목 설치기입니다.

공통 지침은 루트 `AGENTS.md` 하나, 공통 스킬은 `.agents/skills` 하나로 두고,
도구별 설정 파일만 각 도구가 읽는 위치에 만듭니다.

## 사용법

Git 저장소 안에서 실행합니다.

```bash
# 배선 — 공통 지침·스킬·도구별 설정 파일을 만든다
npx agent-setup bootstrap

# 무엇이 만들어질지만 확인한다
npx agent-setup bootstrap --dry-run

# 플러그인·MCP·스킬·DESIGN.md를 골라 설치하는 대화형 화면
npx agent-setup
```

스코프 이름으로도 같은 패키지를 받을 수 있습니다.

```bash
npx @rch4com/agent-setup bootstrap
```

## 안전 원칙

- 반드시 Git 저장소 안에서만 실행되며, 저장소 루트 밖에는 쓰지 않습니다.
- 홈 디렉터리의 글로벌 설정을 읽거나 수정하지 않습니다.
- 기존 설정 파일을 덮어쓰지 않습니다.
- 반복 실행할 수 있습니다.

## 요구 사항

Node.js 20 이상.

## 문서

생성되는 구조, 도구별 연결 방식, 설치 가능한 항목, DESIGN.md 라이브러리 등
상세 문서는 GitHub에 있습니다.

- [사용법과 생성 구조](https://github.com/rch4com/Agent-Setup/blob/main/AgentSetup-README.md)
- [저장소](https://github.com/rch4com/Agent-Setup)

## 라이선스

MIT
````

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `cd agent-installer && node --test "test/pack.test.mjs"`

Expected: PASS 9건.

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/README.md agent-installer/test/pack.test.mjs
git commit -F- <<'EOF'
docs(installer): npm 페이지용 README 추가

npm 패키지 페이지에 뜨는 문서가 없었다. 23KB짜리
AgentSetup-README.md를 복사하면 두 벌 관리가 되므로 설치·명령·
링크만 담고 상세는 GitHub로 링크한다.
EOF
```

---

## Task 4: 태그 트리거 이중 발행 워크플로

**Files:**
- Create: `.github/workflows/publish.yml`

**Interfaces:**
- Consumes: Task 1의 `package.json` — `name: "agent-setup"`, `version: "1.0.0"`, `scripts.test`.
- Produces: 없음. 이후 Task 6이 이 워크플로를 태그 푸시로 실행한다.

- [ ] **Step 1: 워크플로를 쓴다**

`.github/workflows/publish.yml`:

```yaml
name: publish

# v로 시작하는 태그를 밀면 발행한다. 태그와 package.json 버전이
# 어긋난 채 발행되는 것을 막기 위해 첫 단계에서 대조한다.
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write   # npm --provenance가 OIDC 토큰을 요구한다
    defaults:
      run:
        working-directory: agent-installer
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: 태그와 package.json 버전 대조
        run: |
          TAG="${GITHUB_REF_NAME#v}"
          PKG="$(node -p "require('./package.json').version")"
          if [ "$TAG" != "$PKG" ]; then
            echo "태그 v$TAG 와 package.json $PKG 가 다릅니다" >&2
            exit 1
          fi

      - name: 의존성 설치
        run: npm install

      - name: 테스트
        run: npm test

      - name: agent-setup 발행
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      # 같은 내용을 스코프 이름으로 한 번 더 올린다. 러너는 일회용이라
      # package.json을 되돌리지 않는다.
      - name: 스코프 이름으로 재발행
        run: |
          npm pkg set name=@rch4com/agent-setup
          npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2: YAML 문법을 확인한다**

Run:

```bash
node -e "const s=require('fs').readFileSync('.github/workflows/publish.yml','utf8'); if(s.includes('\t')) throw new Error('YAML에 탭 문자'); console.log('줄 수', s.split('\n').length)"
```

Expected: 탭 없음. 줄 수 출력.

GitHub Actions 문법은 푸시해야 검증되므로, 여기서는 탭 부재만 기계적으로 확인하고 실제 실행은 Task 6에서 확인한다.

- [ ] **Step 3: 워크플로 전제를 사람이 확인한다**

이 워크플로가 동작하려면 사람이 해야 하는 준비가 있다. 코드로 대신할 수 없으니 항목으로 남긴다.

- npm 계정에 로그인해 **Automation 타입 access token**을 만든다.
- GitHub 저장소 → Settings → Secrets and variables → Actions에 `NPM_TOKEN`으로 등록한다.
- 두 이름(`agent-setup`, `@rch4com/agent-setup`)이 아직 미등록인지 확인한다 —
  `npm view agent-setup version`이 E404여야 한다.

`--access public`은 스코프 패키지의 첫 발행에 필수다. 없으면 restricted로 올라가 아무도 설치할 수 없다.

- [ ] **Step 4: 커밋**

```bash
git add .github/workflows/publish.yml
git commit -F- <<'EOF'
add: 태그 트리거 npm 이중 발행 워크플로

v 태그를 밀면 테스트와 pack 검증을 거쳐 agent-setup과
@rch4com/agent-setup 두 이름으로 발행한다. 소스는 하나이고
발행 시점에 name만 바꾼다 — 래퍼 패키지를 두면 npx가 tarball을
두 번 받고 버전 고정 의미가 흐려진다.

태그와 package.json 버전이 어긋난 발행을 첫 단계에서 막는다.
EOF
```

---

## Task 5: 문서를 npx 기준으로 고친다

벤더링이 더 이상 필요하지 않다는 사실을 세 문서에 반영한다.

**Files:**
- Modify: `README.md`
- Modify: `AgentSetup-README.md:94-118` (부트스트랩 실행 방법), `:419-452` (팀 저장소에 넣을 파일)
- Modify: `AgentSetup-README-CHANGES.md`

**Interfaces:**
- Consumes: Task 1의 `bin` 이름, Task 3의 README 문구.
- Produces: 없음

- [ ] **Step 1: `README.md`의 빠른 시작을 npx로 바꾼다**

`README.md`의 "빠른 시작" 절 전체를 이 내용으로 교체한다:

````markdown
## 빠른 시작

Git 저장소 안에서 실행합니다. 파일을 복사할 필요가 없습니다.

```bash
npx agent-setup bootstrap            # 배선
npx agent-setup bootstrap --dry-run  # 무엇이 만들어질지만 확인
npx agent-setup                      # 플러그인·MCP·스킬·DESIGN.md 선택 화면
```

스코프 이름(`npx @rch4com/agent-setup`)도 같은 패키지입니다.

저장소에 런처를 두고 쓰고 싶다면 `setup-agents.sh`·`setup-agents.ps1`을
복사하는 방식도 그대로 동작합니다.

```powershell
pwsh -File .\setup-agents.ps1   # Windows
```

```bash
./setup-agents.sh               # Linux / macOS
```
````

- [ ] **Step 2: `AgentSetup-README.md`의 실행 방법 절을 고친다**

"## 부트스트랩 실행 방법" 절 맨 앞에 npx 항목을 넣고, 기존 런처 설명은 남긴다. 첫 문단을 이렇게 바꾼다:

````markdown
## 부트스트랩 실행 방법

가장 짧은 길은 npx입니다. 이 저장소의 파일을 복사하지 않아도 됩니다.

```bash
npx agent-setup bootstrap
npx agent-setup bootstrap --dry-run
npx agent-setup bootstrap --help
```

`npx @rch4com/agent-setup`도 같은 패키지입니다. 두 이름의 내용은 동일합니다.

런처(`./setup-agents.sh`, `pwsh -File ./setup-agents.ps1`)를 저장소에 두고 쓰는
방식도 그대로 동작합니다 — 오프라인 환경이나, 팀원이 커밋된 진입점을 선호할 때
쓰면 됩니다. 두 런처는 실제 로직을 담고 있지 않은 얇은 실행기이며, 부트스트랩
로직은 전부 `agent-installer/lib/bootstrap/`에 있습니다. 새 도구를 추가하려면
`agent-installer/lib/bootstrap/manifest.mjs`에 항목을 추가하고, 도구별 설정
파일이 필요하면 `agent-installer/lib/bootstrap/templates.mjs`에 템플릿을 더합니다.
````

이어지는 `--tui` / `--menu` 설명과 "설치기를 거치지 않고 직접 부를 수도 있습니다" 부분은 그대로 둔다.

- [ ] **Step 3: "팀 저장소에 넣을 파일"에서 벤더링을 뺀다**

`AgentSetup-README.md`의 "## 팀 저장소에 넣을 파일" 절 앞부분을 이렇게 바꾼다:

````markdown
## 팀 저장소에 넣을 파일

`npx agent-setup`을 쓰면 설치기 자체를 커밋할 필요가 없습니다. 커밋 대상은
배선 결과물뿐입니다.

```text
AGENTS.md
CLAUDE.md
GEMINI.md
.agents/skills/
.claude/settings.json
.codex/config.toml
.gemini/settings.json
.github/mcp.json
.github/copilot/settings.json
.grok/config.toml
.kiro/settings/mcp.json
.kimi-code/mcp.json
.vscode/mcp.json
.vscode/settings.json
opencode.jsonc
kilo.jsonc
```

오프라인 환경이거나 커밋된 진입점이 필요하면 `setup-agents.ps1`,
`setup-agents.sh`, `agent-installer/`(node_modules 제외)를 함께 커밋하는
기존 방식도 그대로 동작합니다.
````

절 뒤쪽의 `.mcp.json`·`.kilocode/mcp.json` 설명과 어댑터 gitignore 설명은 그대로 둔다.

- [ ] **Step 4: 변경 이력을 추가한다**

`AgentSetup-README-CHANGES.md`의 형식을 먼저 읽고, 같은 형식으로 항목을 추가한다. 담을 내용:

- `agent-setup`과 `@rch4com/agent-setup` 두 이름으로 npm 발행 시작
- `npx agent-setup bootstrap`으로 파일 복사 없이 배선 가능
- 팀 저장소 커밋 대상에서 `agent-installer/`와 런처 2개가 빠짐(선택 사항이 됨)
- 런처와 벤더링 방식은 그대로 동작함

- [ ] **Step 5: 문서 링크와 명령이 실제와 맞는지 확인한다**

Run:

```bash
cd agent-installer && node install.mjs bootstrap --help
```

Expected: 사용법이 출력된다. 문서에 적은 `--dry-run`·`--help`·`--skill-mode`가 실제 사용법과 일치하는지 눈으로 대조한다. 어긋나면 문서를 고친다(코드가 아니라 문서가 틀린 것이다).

- [ ] **Step 6: 커밋**

```bash
git add README.md AgentSetup-README.md AgentSetup-README-CHANGES.md
git commit -F- <<'EOF'
docs: npx 설치를 기본 경로로 문서화

파일을 복사하지 않고 npx agent-setup bootstrap으로 배선하는 길을
빠른 시작과 실행 방법 절 앞에 둔다. 팀 저장소 커밋 대상에서
agent-installer와 런처 2개를 빼고 선택 사항으로 옮긴다.

런처와 벤더링 방식은 오프라인 환경을 위해 그대로 남긴다.
EOF
```

---

## Task 6: 공개 전환과 첫 발행

**되돌릴 수 없는 작업이다.** 저장소 공개와 npm 발행은 취소할 수 없고, npm은 발행 후 24시간이 지나면 unpublish도 막힌다. 이 작업의 각 단계는 **사용자 확인을 받고** 진행한다.

**Files:**
- 코드 변경 없음. 점검과 실행뿐이다.

**Interfaces:**
- Consumes: Task 1~5 전부. `NPM_TOKEN` 시크릿이 등록돼 있어야 한다(Task 4 Step 3).
- Produces: npm에 발행된 `agent-setup@1.0.0`, `@rch4com/agent-setup@1.0.0`.

- [ ] **Step 1: 이력 전체를 비밀값 패턴으로 훑는다**

워킹트리가 깨끗한 것만으로는 부족하다. 97개 커밋 전체를 본다.

```bash
git log -p --all | grep -nEi \
  'ghp_|github_pat_|sk-[A-Za-z0-9]{20}|xox[baprs]-|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|npm_[A-Za-z0-9]{36}' \
  | head -40
```

Expected: 출력 없음. 무엇이든 걸리면 **공개를 중단하고** 사용자에게 보고한다.

- [ ] **Step 2: 공개될 문서를 확인한다**

```bash
git ls-files docs/
```

`docs/superpowers/` 아래 스펙·플랜이 공개돼도 되는 내용인지 사용자에게 확인받는다. 내부 설계 문서다.

- [ ] **Step 3: 추적되지 않아야 할 것이 정말 추적되지 않는지 확인한다**

```bash
git ls-files | grep -Ei 'debug\.log|^\.omc/|^\.bkit/|^\.superpowers/|node_modules'
git status --short
```

Expected: 첫 명령은 출력 없음. 두 번째는 비어 있거나 의도한 변경만.

- [ ] **Step 4: 사용자 확인을 받아 저장소를 공개로 바꾼다**

되돌릴 수 없다. 사용자에게 Step 1~3 결과를 보여주고 명시적 승인을 받은 뒤 실행한다.

```bash
gh repo edit rch4com/Agent-Setup --visibility public --accept-visibility-change-consequences
gh repo view rch4com/Agent-Setup --json visibility
```

Expected: `{"visibility":"PUBLIC"}`

- [ ] **Step 5: 전체 검증을 돌린다**

`AGENTS.md`의 전체 검증 규정대로 한다.

```bash
cd agent-installer && npm test
```

Expected: 전부 PASS.

```bash
bash ./setup-agents.sh --dry-run
pwsh -File ./setup-agents.ps1 -DryRun
bash -n ./setup-agents.sh
```

Expected: 세 명령 모두 오류 없이 끝난다.

- [ ] **Step 6: 사용자 확인을 받아 태그를 밀어 발행한다**

`NPM_TOKEN` 시크릿이 등록돼 있는지 먼저 확인한다.

```bash
gh secret list --repo rch4com/Agent-Setup
```

Expected: `NPM_TOKEN`이 목록에 있다. 없으면 Task 4 Step 3을 먼저 끝낸다.

사용자 승인을 받은 뒤:

```bash
git tag v1.0.0
git push origin main
git push origin v1.0.0
gh run watch
```

Expected: publish 워크플로가 성공한다. 실패하면 로그를 읽고 원인을 보고한다 — 태그를 다시 밀기 전에 실패 원인을 고쳐야 하고, 같은 버전 번호로는 재발행할 수 없으므로 `1.0.1`로 올려야 할 수 있다.

- [ ] **Step 7: 실제로 설치되는지 확인한다**

발행이 registry에 전파되는 데 잠깐 걸린다.

```bash
npm view agent-setup version
npm view @rch4com/agent-setup version
```

Expected: 둘 다 `1.0.0`.

스크래치 Git 저장소에서 실제로 돌려 본다. 이 계획의 목표가 달성됐는지 판정하는 유일한 증거다.

```bash
cd "$(mktemp -d)" && git init -q . && npx -y agent-setup@1.0.0 bootstrap --dry-run
```

Expected: 파일을 하나도 만들지 않고 무엇이 만들어질지 출력한다. 그다음 실제 실행:

```bash
npx -y agent-setup@1.0.0 bootstrap && git status --short
```

Expected: `AGENTS.md`, `.agents/skills/`, 도구별 설정 파일이 생기고 `git status`에 스테이징 대상으로 보인다. `.vscode/mcp.json`과 `.vscode/settings.json`이 **함께** 보여야 한다 — 둘 다 gitignore 부정 항목에 의존하므로 하나가 빠지면 조용히 실패한 것이다.

한 번 더 돌려 멱등성을 확인한다.

```bash
npx -y agent-setup@1.0.0 bootstrap && git status --short
```

Expected: 1회차와 동일한 목록. `.claude/skills`, `.kiro/skills`, `.grok/skills`는 스테이징되지 않는다.

- [ ] **Step 8: 결과를 보고한다**

커밋할 것이 없다. 사용자에게 보고한다.

- 발행된 두 패키지 이름과 버전
- 스크래치 저장소 검증 결과(생성 파일, 멱등성, `.vscode` 두 파일 확인)
- 남은 단계(2단계 설치 기록·갱신 엔진, 3단계 명령 재편)

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 요구 | 담당 |
|---|---|
| npm 공개 발행 | Task 1(메타데이터), Task 4(워크플로), Task 6(실행) |
| 이중 이름 발행 | Task 4 재발행 단계 |
| 발행 루트 = `agent-installer/` | Task 1의 `files` |
| `files` 화이트리스트 오류 방어 | Task 1의 pack 테스트 |
| 패키지 크기 상한 | Task 1의 2MiB 검사 |
| LICENSE(MIT) | Task 2 |
| npm 페이지용 README | Task 3 |
| 공개 전환 점검(비밀값 이력·docs·gitignore) | Task 6 Step 1~3 |
| 문서 갱신 | Task 5 |
| 1단계 종료 조건(`npx agent-setup@1.0.0 bootstrap` 동작) | Task 6 Step 7 |
| 격리 불변식 유지 | Task 1 Step 5 |

스펙의 2단계·3단계 요구는 이 계획 범위 밖이며, 계획 머리말에 명시했다.

**2. 플레이스홀더**

없다. 모든 코드·설정·문서 블록이 그대로 붙여 쓸 수 있는 실제 내용이다. Task 5 Step 4만 "기존 형식을 먼저 읽고 같은 형식으로"라고 지시하는데, 이는 담을 내용 4개를 열거했으므로 판단이 아니라 형식 맞추기다.

**3. 타입·이름 일관성**

- `PKG_ROOT`, `NPM`, `packInfo()`, `ALLOWED_TOP`, `cached` — Task 1에서 정의하고 Task 2·3이 같은 이름으로 참조한다.
- 패키지 이름 `agent-setup`, bin 이름 `agent-setup`, 스코프 `@rch4com/agent-setup` — Task 1·3·4·5·6에서 일관된다.
- 버전 `1.0.0` — Task 1(`package.json`), Task 6(`v1.0.0` 태그, `npm view` 확인)에서 일관된다.
- `files` 목록 `["install.mjs", "lib/", "README.md", "LICENSE"]` — Task 1이 정의하고 Task 2·3이 그 안에 파일을 만든다. `ALLOWED_TOP`이 여기에 `package.json`을 더한 집합이다.

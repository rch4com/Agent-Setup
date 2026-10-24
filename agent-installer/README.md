# agent-setup

Repository-scoped bootstrap for using many coding agents in one repo — plus an
optional picker for plugins, MCP servers, skills, and DESIGN.md documents.

Supports **Claude Code, Codex, OpenCode, and Antigravity.**

One shared instruction file (`AGENTS.md`) and one shared skills directory
(`.agents/skills`) serve every tool. Only the per-tool config files are written,
each in the location that tool actually reads.

[한국어 문서는 아래에 있습니다 ↓](#한국어)

## Usage

Run inside a Git repository. Nothing needs to be copied into your repo.

```bash
# Wire up shared instructions, skills, and per-tool config files
npx @rch4com/agent-setup bootstrap

# Show what would be created, without writing anything
npx @rch4com/agent-setup bootstrap --dry-run

# Interactive picker for plugins, MCP servers, skills, and DESIGN.md —
# installs with each CLI's own install commands
npx @rch4com/agent-setup

# Install user-globally instead of into this repository
npx @rch4com/agent-setup --global

# Print the CLI commands instead of running them (--dry-run is an alias)
npx @rch4com/agent-setup --print --set plugin.ponytail
```

The package name is scoped, but the installed command is just `agent-setup` —
the long form only appears when invoking it through `npx`.

The screen speaks your OS language by default, falling back to English. Pass
`--lang en|ko` (or set `AGENT_SETUP_LANG`) to pick one for this run. The
interactive screen's first row also switches it, and the choice is remembered
in `.agent-kit/agent-setup.json`.

## Keeping in sync

```bash
npx @rch4com/agent-setup@latest update             # pull in improved templates
npx @rch4com/agent-setup@latest update --dry-run   # preview the changes
npx @rch4com/agent-setup status                    # intent / reality / version
```

`update` only rewrites files that are **still exactly as this tool wrote them**.
The decision is made per file, using hashes stored in the install record
(`.agent-kit/agent-setup.json`, which is committed).

| Situation | What happens |
|---|---|
| Hash matches the record | Replaced with the new template |
| Hash differs | You edited it → **left alone**, reported as drift |
| File missing | Created (this is how support for new tools arrives) |
| No hash in the record | Origin unknown → left alone |

The managed block in `CLAUDE.md` is replaced **between the markers only**, so
anything you wrote around it survives.

Hashes are computed after normalizing line endings to LF, so a CRLF checkout on
Windows is not mistaken for drift.

Use `update --force` to overwrite drifted files too. It refuses to run unless the
working tree is clean, because git is the only way to undo it.

### Adopting a repository that already uses this

Repositories that vendored the installer have no record yet.

```bash
npx @rch4com/agent-setup bootstrap --adopt
```

This writes no files — it only creates the record. Files are adopted **only if
they match this version's template**, because stamping a hash onto a file you had
already customized would let the next `update` erase your changes. Unadopted files
show up in `status` and can be pulled in later with `update --force`.

## Safety

The rules below are what the **bootstrap** (`bootstrap`, `update`, `status`)
upholds. The optional-item picker runs each CLI's official install commands,
which fetch third-party code, and with `--global` (or the Install scope row) it
deliberately installs into per-user CLI configuration under your home directory
— the review screen warns before that happens. The full list of what each item
runs is in the
[usage guide](https://github.com/rch4com/Agent-Setup/blob/main/AgentSetup-README.md#what-the-installer-runs).

- Runs only inside a Git repository, and never writes outside the repository root.
- Never reads or modifies global configuration in your home directory.
- Never overwrites existing configuration files.
- Safe to run repeatedly.

## Requirements

Node.js 20 or later.

## Documentation

The generated layout, how each tool is wired, the installable items, and the
DESIGN.md library are documented on GitHub.

- [Usage and generated structure](https://github.com/rch4com/Agent-Setup/blob/main/AgentSetup-README.md)
- [Changelog](https://github.com/rch4com/Agent-Setup/blob/main/AgentSetup-README-CHANGES.md)
- [Repository](https://github.com/rch4com/Agent-Setup)

## License

MIT

---

# 한국어

Claude Code, Codex, OpenCode, Antigravity를 **한 저장소에서 함께** 쓰기 위한
저장소 범위 부트스트랩과 선택 항목 설치기입니다.

공통 지침은 루트 `AGENTS.md` 하나, 공통 스킬은 `.agents/skills` 하나로 두고,
도구별 설정 파일만 각 도구가 읽는 위치에 만듭니다.

## 사용법

Git 저장소 안에서 실행합니다. 저장소에 복사해 둘 파일이 없습니다.

```bash
# 배선 — 공통 지침·스킬·도구별 설정 파일을 만든다
npx @rch4com/agent-setup bootstrap

# 무엇이 만들어질지만 확인한다
npx @rch4com/agent-setup bootstrap --dry-run

# 플러그인·MCP·스킬·DESIGN.md를 골라 설치하는 대화형 화면 —
# 각 CLI의 공식 설치 명령으로 설치한다
npx @rch4com/agent-setup

# 이 저장소 대신 사용자 전역에 설치한다
npx @rch4com/agent-setup --global

# 실행하지 않고 CLI 명령만 출력한다 (--dry-run과 같음)
npx @rch4com/agent-setup --print --set plugin.ponytail
```

패키지 이름에는 스코프가 붙지만 설치 후 실행 명령은 `agent-setup`입니다 —
길어지는 것은 `npx`로 직접 부를 때뿐입니다.

화면 언어는 기본으로 OS 언어를 따르고, 지원하지 않으면 영어로 갑니다.
이번 실행만 다른 언어로 보려면 `--lang en|ko`를 주거나 `AGENT_SETUP_LANG`을
설정하세요. 대화형 화면의 첫 행에서도 바꿀 수 있고, 고른 언어는
`.agent-kit/agent-setup.json`에 저장되어 다음 실행에도 이어집니다.

## 최신으로 갱신하기

```bash
npx @rch4com/agent-setup@latest update             # 개선된 템플릿을 받아온다
npx @rch4com/agent-setup@latest update --dry-run   # 무엇이 바뀔지만 확인
npx @rch4com/agent-setup status                    # 의도 / 실제 / 버전 비교
```

`update`는 **우리가 쓴 그대로인 파일만** 다시 씁니다. 판정은 파일마다 따로 하며,
근거는 커밋되는 설치 기록(`.agent-kit/agent-setup.json`)에 남은 해시입니다.

| 상황 | 처리 |
|---|---|
| 기록된 해시와 일치 | 새 템플릿으로 교체 |
| 해시가 다름 | 사용자가 고쳤음 → **건드리지 않고** 드리프트로 보고 |
| 파일이 없음 | 새로 생성 (새 도구 지원이 이 경로로 들어옵니다) |
| 기록에 해시가 없음 | 출처 불명 → 건드리지 않음 |

`CLAUDE.md`의 관리 블록은 **마커 사이만** 교체하므로 주변에 쓴 내용은 그대로
남습니다.

해시는 줄바꿈을 LF로 정규화한 뒤 계산하므로, Windows에서 CRLF로 체크아웃해도
드리프트로 오판하지 않습니다.

드리프트 파일까지 반영하려면 `update --force`를 씁니다. git이 유일한 되돌리기
수단이므로 워킹트리가 깨끗할 때만 동작합니다.

### 이미 쓰던 저장소 끌어오기

설치기를 복사해 쓰던 저장소에는 기록이 없습니다.

```bash
npx @rch4com/agent-setup bootstrap --adopt
```

파일을 만들지 않고 기록만 만듭니다. **이 버전의 템플릿과 같은 파일만** 채택하는데,
이미 고쳐 둔 파일에 해시를 박으면 다음 `update`가 그 수정을 지워버리기
때문입니다. 채택되지 않은 파일은 `status`에 나오고, 원할 때 `update --force`로
들여올 수 있습니다.

## 안전 원칙

아래는 **부트스트랩**(`bootstrap`·`update`·`status`)이 지키는 규칙입니다.
선택 항목 화면은 제3자 코드를 내려받는 각 CLI의 공식 설치 명령을 실행하며,
`--global`(또는 설치 범위 행)을 고르면 의도적으로 홈 디렉터리 아래 CLI별 사용자
설정에 설치합니다 — 그 전에 검토 화면이 경고합니다. 항목마다 무엇을 실행하는지는
[사용 안내](https://github.com/rch4com/Agent-Setup/blob/main/AgentSetup-README.ko.md#설치기가-실행하는-것)에
있습니다.

- 반드시 Git 저장소 안에서만 실행되며, 저장소 루트 밖에는 쓰지 않습니다.
- 홈 디렉터리의 글로벌 설정을 읽거나 수정하지 않습니다.
- 기존 설정 파일을 덮어쓰지 않습니다.
- 반복 실행할 수 있습니다.

## 요구 사항

Node.js 20 이상.

## 문서

생성되는 구조, 도구별 연결 방식, 설치 가능한 항목, DESIGN.md 라이브러리 등
상세 문서는 GitHub에 있습니다.

- [사용법과 생성 구조](https://github.com/rch4com/Agent-Setup/blob/main/AgentSetup-README.ko.md)
- [변경 이력](https://github.com/rch4com/Agent-Setup/blob/main/AgentSetup-README-CHANGES.ko.md)
- [저장소](https://github.com/rch4com/Agent-Setup)

## 라이선스

MIT

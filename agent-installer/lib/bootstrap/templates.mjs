// setup-agents.ps1의 here-string 내용을 옮긴 단일 출처.
// 여기만 고치면 모든 OS가 같은 파일을 만든다.

export const AGENTS_TEMPLATE = `# Repository Instructions

## Scope

These instructions apply only to this repository.

## Project documents

These documents hold the project's intent, specification, design, plan, and
review rules. They start as drafts: a \`Status: draft\` line, \`<TBD: …>\`
placeholders, and an "Interview guide" section at the end.

| File | Holds |
|---|---|
| \`docs/intent.md\` | why the project exists, who it is for, what success means |
| \`docs/spec.md\` | what it must do, with checkable acceptance criteria |
| \`docs/architecture.md\` | how it is built, and the decisions behind it |
| \`docs/plan.md\` | milestones and tasks, each with a way to verify it |
| \`docs/review.md\` | how changes are checked before they are called done |
| \`README.md\` | what a newcomer needs: purpose, quick start, links |

Rules:

- Before non-trivial work, read the documents the task touches. A document with
  \`Status: ready\` is the source of truth; if code and document disagree, say so
  and ask which one is right.
- A document with \`Status: draft\` or any \`<TBD: …>\` placeholder is a draft and
  not authoritative. If the current task depends on it, interview the user to
  fill it in first. Otherwise note that it is a draft and carry on - do not
  interrupt unrelated work.
- The bootstrap appends only the sections a hand-written document lacks, and
  adds no Status line. When such a document is complete, add \`> Status: ready\`
  under its title; the bootstrap then leaves it alone.
- Keep documents in sync: a change that alters behavior updates the spec, a
  change that alters structure updates the architecture (record decisions
  there), and a plan task is checked off only after its verification ran.
- If \`docs/plan.md\` names an issue tracker, tasks live in the tracker. The plan
  keeps only the goal, milestones (each linking its issues), and risks.

## Document interview

This section applies only while a project document is a draft. When no document
above has \`Status: draft\` or a \`<TBD: …>\` placeholder left, delete this whole
section from AGENTS.md; the bootstrap does not add it back once every document
is complete.

- Interview protocol: follow the document's Interview guide. Ask one question at
  a time, offer a recommended answer, build on earlier answers, and write only
  what the user confirmed. Never invent facts; leave \`<TBD: question>\` for
  anything still unknown. When every placeholder is resolved, delete the
  Interview guide and set \`Status: ready\`.
- Fill in this order: intent, spec, architecture, plan. \`docs/review.md\` any
  time; \`README.md\` last. If the code already exists, read it first and ask
  the user to confirm what you found instead of asking from scratch.

## Required workflow

1. Inspect the relevant existing implementation before editing.
2. Make the smallest change that satisfies the requirement.
3. Add or update tests for behavior changes.
4. Run focused verification first, then the full repository checks.
5. Report anything that could not be verified.

## Repository commands

Document the actual commands used by this repository:

- Install:
- Build:
- Test:
- Lint:
- Full verification:

## Rules

- Do not modify files outside this repository.
- Do not add production dependencies without explicit approval.
- Do not edit generated files directly.
- Never commit credentials, access tokens, or connection strings.

## Behavioral guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

**Scope:** Only what current models still get wrong. If the model or the
harness already handles something reliably, it doesn't belong here - a rule
that restates default behavior burns context and buys nothing.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial
tasks, use judgment.

### 1. State Assumptions, Then Proceed

**Say what you assumed. Keep going. Default the rest.**

Before implementing:

- State your assumptions in one line, then start.
- If multiple interpretations exist, pick the likeliest and say which one you
  picked.
- If a simpler approach exists, say so while doing the work - not as a question
  that blocks it.
- Ask only when the answer changes what gets built, not how well, and the wrong
  choice can't be cheaply undone.

A stated assumption gets corrected in seconds. A question costs a round-trip
and hands the work back to the user. If you're about to ask a second question
in one task, you're doing it wrong.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes,
simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Verify Before Done

**If you touched code, run the check before saying "done" - and report what
actually ran.**

- \`npm test\`, \`pytest\`, \`cargo test\`, whatever the project uses. Smallest
  relevant check first, broader checks when risk is high.
- No test setup? At minimum, verify the project builds or typechecks.
- Report the exact command and its result: "passed", "failed with X", or "not
  run because Y".
- Never write "done", "fixed", or "works" unless a concrete check backs it.
- Run it proactively, before the user signals "끝", "완료", "다 됐어".

This is the step LLMs skip most often. Treat it as non-negotiable.

### 5. Teach One Thing On The Way Out

**End with what the user would want to know next time. Two or three
sentences.**

When the work is done:

- Name the one concept, tradeoff, or gotcha that actually mattered here.
- Teach what the code doesn't show: why this way over the obvious one, which
  default you leaned on, what breaks first at scale.
- If it needs a heading, it's too long. If it restates the diff, delete it.
- Skip it when the change is trivial, or when the user is the one who taught
  you the thing.

Why: an agent that only ships code leaves the user unable to maintain it. They
should finish each task slightly more able to do it without you.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer
rewrites due to overcomplication, and stated assumptions get corrected early
instead of surfacing as mistakes late.`

// AGENTS_TEMPLATE의 한글판. 절(`## `)의 개수와 순서는 영문판과 같아야 한다 —
// snippets.mjs가 제목을 순서로 짝지어 어느 언어의 제목이든 같은 절로 본다.
export const AGENTS_TEMPLATE_KO = `# 저장소 지침

## 적용 범위

이 지침은 이 저장소에만 적용됩니다.

## 프로젝트 문서

이 문서들은 프로젝트의 의도, 명세, 설계, 계획, 리뷰 규칙을 담습니다. 처음에는
초안입니다: \`Status: draft\` 줄, \`<TBD: …>\` 자리표시자, 끝의 "인터뷰 가이드" 절이 있습니다.

| 파일 | 담는 것 |
|---|---|
| \`docs/intent.md\` | 프로젝트가 존재하는 이유, 대상 사용자, 성공의 의미 |
| \`docs/spec.md\` | 해야 하는 일과 확인 가능한 완료 기준 |
| \`docs/architecture.md\` | 어떻게 만들어졌는지와 그 뒤의 결정 |
| \`docs/plan.md\` | 마일스톤과 작업, 각 작업의 검증 방법 |
| \`docs/review.md\` | 변경을 끝났다고 부르기 전에 확인하는 방법 |
| \`README.md\` | 처음 온 사람에게 필요한 것: 목적, 빠른 시작, 링크 |

규칙:

- 사소하지 않은 작업 전에 그 작업이 다루는 문서를 읽습니다. \`Status: ready\` 문서가
  기준입니다. 코드와 문서가 어긋나면 그 사실을 말하고 어느 쪽이 맞는지 묻습니다.
- \`Status: draft\`이거나 \`<TBD: …>\` 자리표시자가 하나라도 있는 문서는 초안이라
  기준이 아닙니다. 지금 작업이 그 문서에 달려 있으면 먼저 사용자를 인터뷰해
  채웁니다. 그렇지 않으면 초안이라는 점만 알리고 진행합니다 - 관계없는 작업을
  끊지 않습니다.
- 부트스트랩은 직접 쓴 문서에 없는 절만 덧붙이고 Status 줄은 넣지 않습니다. 그런
  문서가 완성되면 제목 아래에 \`> Status: ready\`를 적으세요. 그러면 부트스트랩이
  그 문서를 건드리지 않습니다.
- 문서를 코드와 맞춥니다: 동작을 바꾸는 변경은 명세를, 구조를 바꾸는 변경은
  아키텍처를 갱신하고(결정은 거기에 기록), 계획의 작업은 검증을 돌린 뒤에만 체크합니다.
- \`docs/plan.md\`가 이슈 트래커를 밝히면 작업은 트래커에 둡니다. 계획에는 목표,
  마일스톤(각각 이슈 링크), 위험만 남깁니다.

## 문서 인터뷰

이 절은 프로젝트 문서가 초안인 동안만 적용됩니다. 위 문서 중 \`Status: draft\`이거나
\`<TBD: …>\` 자리표시자가 남은 것이 없으면 AGENTS.md에서 이 절 전체를 지웁니다.
모든 문서가 완성된 뒤에는 부트스트랩이 이 절을 다시 넣지 않습니다.

- 인터뷰 규칙: 문서의 인터뷰 가이드를 따릅니다. 질문은 한 번에 하나씩 하고, 추천
  답을 함께 제시하고, 앞선 답을 이어받고, 사용자가 확인한 내용만 적습니다. 사실을
  지어내지 않습니다. 모르는 것은 \`<TBD: 질문>\`으로 남깁니다. 자리표시자를 모두
  채우면 인터뷰 가이드를 지우고 \`Status: ready\`로 바꿉니다.
- 채우는 순서: intent, spec, architecture, plan. \`docs/review.md\`는 언제든,
  \`README.md\`는 마지막. 코드가 이미 있으면 처음부터 묻지 말고 먼저 읽은 뒤 찾은
  내용을 사용자에게 확인받습니다.

## 필수 작업 흐름

1. 수정하기 전에 관련된 기존 구현을 먼저 확인합니다.
2. 요구사항을 만족하는 가장 작은 변경을 합니다.
3. 동작이 바뀌면 테스트를 추가하거나 갱신합니다.
4. 좁은 범위의 검증을 먼저, 그다음 저장소 전체 검사를 실행합니다.
5. 검증하지 못한 것은 모두 보고합니다.

## 저장소 명령

이 저장소가 실제로 쓰는 명령을 적습니다:

- 설치:
- 빌드:
- 테스트:
- 린트:
- 전체 검증:

## 규칙

- 이 저장소 밖의 파일을 수정하지 않습니다.
- 명시적 승인 없이 프로덕션 의존성을 추가하지 않습니다.
- 생성된 파일을 직접 편집하지 않습니다.
- 자격 증명, 접근 토큰, 연결 문자열을 절대 커밋하지 않습니다.

## 행동 지침

LLM이 흔히 하는 코딩 실수를 줄이기 위한 행동 지침입니다.

**범위:** 현재 모델이 여전히 틀리는 것만 담습니다. 모델이나 하네스가 이미 안정적으로
처리하는 것은 여기에 두지 않습니다 - 기본 동작을 되풀이하는 규칙은 문맥만 쓰고
얻는 것이 없습니다.

**트레이드오프:** 이 지침은 속도보다 신중함에 치우쳐 있습니다. 사소한 작업에서는
판단하세요.

### 1. 가정을 밝히고, 진행한다

**무엇을 가정했는지 말하고, 계속 가고, 나머지는 기본값으로 둔다.**

구현하기 전에:

- 가정을 한 줄로 밝히고 바로 시작합니다.
- 해석이 여러 개면 가장 그럴듯한 것을 골라 어느 것을 골랐는지 말합니다.
- 더 단순한 방법이 있으면 작업을 막는 질문이 아니라 작업하는 중에 말합니다.
- 답이 만들 것 자체를 바꾸고(품질이 아니라) 잘못 골랐을 때 싸게 되돌릴 수 없을
  때만 묻습니다.

밝힌 가정은 몇 초면 바로잡힙니다. 질문은 한 번의 왕복을 쓰고 일을 사용자에게
돌려줍니다. 한 작업에서 두 번째 질문을 하려 한다면 잘못하고 있는 것입니다.

### 2. 단순함이 먼저

**문제를 푸는 최소한의 코드. 추측성 코드는 없다.**

- 요청한 것 이상의 기능은 없습니다.
- 한 번만 쓰는 코드를 위한 추상화는 없습니다.
- 요청하지 않은 "유연성"이나 "설정 가능성"은 없습니다.
- 일어날 수 없는 상황을 위한 오류 처리는 없습니다.
- 200줄을 썼는데 50줄로 줄일 수 있다면 다시 씁니다.

스스로 묻습니다: "시니어 엔지니어가 이걸 과하다고 할까?" 그렇다면 단순화합니다.

### 3. 수술하듯 바꾼다

**꼭 필요한 곳만 건드린다. 내가 어지른 것만 치운다.**

기존 코드를 고칠 때:

- 인접한 코드, 주석, 서식을 "개선"하지 않습니다.
- 고장 나지 않은 것을 리팩터링하지 않습니다.
- 내가 다르게 했을 것이라도 기존 스타일에 맞춥니다.
- 관련 없는 죽은 코드를 발견하면 알리기만 하고 지우지 않습니다.

내 변경이 고아를 만들면:

- 내 변경 때문에 쓰이지 않게 된 import·변수·함수는 지웁니다.
- 원래부터 있던 죽은 코드는 요청이 없으면 지우지 않습니다.

기준: 바뀐 모든 줄이 사용자의 요청으로 곧바로 거슬러 올라가야 합니다.

### 4. 끝내기 전에 검증한다

**코드를 건드렸다면 "끝"이라고 말하기 전에 검사를 돌리고, 실제로 돌린 것을 보고한다.**

- \`npm test\`, \`pytest\`, \`cargo test\` 등 프로젝트가 쓰는 것을 실행합니다. 가장 작은
  관련 검사부터, 위험이 크면 더 넓은 검사를 합니다.
- 테스트가 없다면 최소한 프로젝트가 빌드되거나 타입 검사를 통과하는지 확인합니다.
- 정확한 명령과 결과를 보고합니다: "통과", "X로 실패", "Y 때문에 실행하지 못함".
- 구체적인 검사가 뒷받침하지 않으면 "완료", "고쳤다", "동작한다"라고 쓰지 않습니다.
- 사용자가 "끝", "완료", "다 됐어"라고 하기 전에 먼저 돌립니다.

LLM이 가장 자주 건너뛰는 단계입니다. 타협하지 않습니다.

### 5. 나가는 길에 한 가지를 가르친다

**다음에 사용자가 알고 싶어 할 것으로 끝낸다. 두세 문장.**

작업이 끝나면:

- 이번에 실제로 중요했던 개념, 트레이드오프, 함정 하나를 짚습니다.
- 코드가 보여 주지 않는 것을 가르칩니다: 왜 뻔한 방법 대신 이 방법인지, 어떤
  기본값에 기댔는지, 규모가 커지면 무엇이 먼저 깨지는지.
- 제목이 필요하다면 너무 긴 것입니다. diff를 되풀이한다면 지웁니다.
- 변경이 사소하거나 사용자가 그것을 가르쳐 준 사람이면 생략합니다.

이유: 코드만 내놓는 에이전트는 사용자가 유지보수를 못 하게 만듭니다. 사용자는
작업이 끝날 때마다 에이전트 없이도 조금 더 할 수 있게 되어야 합니다.

---

**이 지침이 잘 작동하는 경우:** 불필요한 변경이 줄고, 과설계 때문에 다시 쓰는 일이
줄고, 밝힌 가정이 나중에 실수로 드러나는 대신 일찍 바로잡힙니다.`

export const CLAUDE_BLOCK = `<!-- agent-kit:begin -->
@AGENTS.md
<!-- agent-kit:end -->`

export const SKILL_README = `# Shared repository skills

Create each shared skill in:

\`.agents/skills/<skill-name>/SKILL.md\`

Use portable Agent Skills frontmatter:

\`\`\`yaml
---
name: example-skill
description: Explain when this skill should be used.
---
\`\`\`

Claude Code receives these skills through the project-local adapter at
\`.claude/skills\`. Codex, OpenCode, and Antigravity discover \`.agents/skills\`
directly.`

export const EXAMPLE_SKILL = `---
name: repository-check
description: Verify repository changes by reviewing the diff and running the documented build, test, and lint commands. Use before reporting implementation work as complete.
---

# Repository check

1. Read \`AGENTS.md\`.
2. Review the complete working-tree diff.
3. Run the smallest relevant checks first.
4. Run the repository's documented full verification command.
5. Report failures, skipped checks, and remaining risks.`

export const AGENT_KIT_README = `# Repository-local agent setup

This directory documents files generated or used by the bootstrap scripts.

The installer bootstrap:

- finds the current Git repository root;
- refuses to write outside that repository;
- creates only project-scoped configuration;
- never writes to user-home or system-wide agent configuration;
- preserves existing configuration files;
- adds a small managed import block to \`CLAUDE.md\`;
- exposes \`.agents/skills\` to Claude Code through a local adapter;
- relies on the native support of Codex, OpenCode, and Antigravity for
  \`AGENTS.md\` and \`.agents/skills\`.`

// Claude Code의 Code Mode(실험 기능)를 이 저장소에서 기본으로 켠다. 환경 변수라 settings.json의
// env에 둔다 — 프로젝트 설정이 커밋되므로 팀 전체에 적용된다. 끄려면 값을 "0"으로 바꾸거나
// 키를 지운다(없을 때만 넣으므로 "0"은 다시 켜지지 않는다). Claude 2.1.325 바이너리에서
// CLAUDE_CODE_EXPERIMENTAL_CODE_MODE 이름을 확인했다.
export const CLAUDE_SETTINGS = `{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_CODE_MODE": "1"
  }
}`

export const CODEX_CONFIG = `# Repository-local Codex configuration.
# Personal or machine-wide defaults belong outside this repository.
project_doc_max_bytes = 65536`

export const OPENCODE_CONFIG = `{
  "$schema": "https://opencode.ai/config.json"
}`

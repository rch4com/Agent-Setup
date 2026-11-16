// 부트스트랩이 만드는 프로젝트 문서 여섯 개(README·intent·spec·architecture·plan·review)의
// 언어별 템플릿. AGENTS.md는 templates.mjs에 있고 이 문서들을 안내하는 절을 담는다. 모든 문서는 `Status: draft` 줄과 끝의 인터뷰 가이드를 갖는다 —
// 에이전트가 초안인 문서를 만나면 사용자를 인터뷰해 채우도록 AGENTS.md가 안내한다.
//
// 구조(제목 순서·개수)는 두 언어가 같아야 한다. snippets.mjs가 제목을 순서로 짝지어
// 영문·한글 어느 쪽 제목이 이미 있어도 같은 절로 보기 때문이다(project-docs.test).
// 문서 안의 키워드(`Status: draft`, `<TBD: …>`)는 언어와 무관하게 영어로 고정한다 —
// 지침과 에이전트가 같은 문자열로 초안 여부를 판정해야 한다.

const EN = {
  readme: `# <TBD: project name>

> Status: draft — fill this in through an interview (see the Interview guide at the end).

<TBD: one-line description of what this project is and who it is for>

## Why

<TBD: the problem this solves, in two or three sentences. Details belong in docs/intent.md>

## Quick start

\`\`\`sh
# Install:  <TBD>
# Run:      <TBD>
# Test:     <TBD>
\`\`\`

## Usage

<TBD: the most common use, with a short example>

## Project structure

<TBD: the main directories and what each holds>

## Documentation

- [Intent](docs/intent.md) — why this exists, who it is for, what success means
- [Specification](docs/spec.md) — what it must do
- [Architecture](docs/architecture.md) — how it is built
- [Plan](docs/plan.md) — what is being done, in what order
- [Review](docs/review.md) — how changes are checked
- [AGENTS.md](AGENTS.md) — instructions for coding agents

## Contributing

<TBD: how to propose a change, branch and commit conventions>

## License

<TBD: license name>

## Interview guide

Delete this section when every \`<TBD: …>\` is resolved, and remove the Status line.
Ask one question at a time, offer a recommended answer, and write only what the user confirmed.
Run the real commands before putting them in Quick start.

1. What is the project, in one sentence, and who is it for?
2. What is the single most common thing a user does with it?
3. What are the exact install, run, and test commands? (Verify them.)
4. How do people contribute, and what license applies?
`,

  intent: `# Intent

> Status: draft — fill this in through an interview (see the Interview guide at the end).

The reason this project exists. Everything else (spec, architecture, plan) follows from this file.

## Purpose

<TBD: what this is and why it is needed now>

## Users

<TBD: the primary users and the problem each one has>

## Success criteria

<TBD: how we will know it worked — measurable where possible>

## Non-goals

<TBD: what this deliberately does not do>

## Constraints

<TBD: deadline, budget, platform, regulatory, team-size, or technology limits>

## Principles

<TBD: how to decide when goals conflict, e.g. "simple over flexible">

## Open questions

- <TBD: anything still undecided>

## Interview guide

Delete this section when every \`<TBD: …>\` is resolved, and set the Status to \`ready\`.
Ask one question at a time, offer a recommended answer, and write only what the user confirmed.

1. What is this project, and why is it needed now?
2. Who uses it, and what is each user's biggest problem today?
3. How will you know it succeeded? Which numbers or observable results?
4. What will it deliberately not do?
5. What limits apply: time, budget, platform, rules, team?
6. When two goals conflict, which one wins?
`,

  spec: `# Specification

> Status: draft — fill this in through an interview (see the Interview guide at the end).

What the system must do. Each requirement has an ID and an acceptance criterion that can be checked.
Read docs/intent.md first.

## Scope

<TBD: what this version covers>

## Out of scope

<TBD: what this version does not cover>

## Scenarios

1. <TBD: the main scenario — who does what, and what they get>

## Functional requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| FR-1 | <TBD> | <TBD: a check that passes or fails> |

## Non-functional requirements

<TBD: performance, security, privacy, accessibility, compatibility, reliability targets>

## Interfaces and data

<TBD: inputs, outputs, data model, external APIs, file formats>

## Errors and edge cases

<TBD: what happens on invalid input, failures, empty states, limits>

## Glossary

| Term | Meaning |
|---|---|
| <TBD> | <TBD> |

## Interview guide

Delete this section when every \`<TBD: …>\` is resolved, and set the Status to \`ready\`.
Ask one question at a time, offer a recommended answer, and write only what the user confirmed.

1. Walk me through the three most important things a user does. What do they start with, and what do they get?
2. For each feature, how do we check that it is done?
3. What goes in and out: data, formats, other systems?
4. What should happen when things go wrong or input is odd?
5. Any targets for speed, security, privacy, accessibility, or compatibility?
6. What is explicitly left for a later version?
`,

  architecture: `# Architecture

> Status: draft — fill this in through an interview (see the Interview guide at the end).

How the system is built and why. Keep it short enough to stay true. Read docs/spec.md first.

## Overview

<TBD: the system in one paragraph>

## Technology

| Area | Choice | Why |
|---|---|---|
| Language / runtime | <TBD> | <TBD> |
| Framework / libraries | <TBD> | <TBD> |
| Storage | <TBD> | <TBD> |

## Components

<TBD: each major component, what it owns, and what it must not do>

\`\`\`mermaid
flowchart LR
  A[<TBD: component>] --> B[<TBD: component>]
\`\`\`

## Data flow

<TBD: how a request or piece of data moves through the components>

## Directory layout

<TBD: the main directories and the rule for what goes where>

## External dependencies

<TBD: services, APIs, and packages the system relies on, and what happens if one is down>

## Decisions

| Date | Decision | Reason | Alternatives rejected |
|---|---|---|---|
| <TBD> | <TBD> | <TBD> | <TBD> |

## Build, test, and deploy

<TBD: how the system is built, verified, and released>

## Boundaries and risks

<TBD: layering rules, known weak points, things not to change casually>

## Interview guide

Delete this section when every \`<TBD: …>\` is resolved, and set the Status to \`ready\`.
Ask one question at a time, offer a recommended answer, and write only what the user confirmed.
If the code already exists, read it first and ask the user to confirm what you found.

1. Which language, runtime, and framework, and why?
2. What are the main components, and what does each own?
3. Where is data stored, and how does it flow?
4. Which external systems and packages does it depend on?
5. Which decisions are already made, and why?
6. How is it built, tested, and deployed?
7. Which boundaries must hold, and what is risky to change?
`,

  plan: `# Plan

> Status: draft — fill this in through an interview (see the Interview guide at the end).

What is being done, in what order, and how each step is verified. Update it in the same change as the work.
Read docs/spec.md and docs/architecture.md first.

## Goal

<TBD: the outcome of the current phase and its deadline>

## Milestones

| # | Milestone | Done when | Target date |
|---|---|---|---|
| 1 | <TBD> | <TBD: a check that passes> | <TBD> |

## Task tracking

<TBD: the issue tracker that holds the tasks (name and link), or "none">

With an issue tracker, the tracker is the source of truth for tasks: keep only the goal, milestones (each linking its issues), and risks here, and replace the Tasks list below with those links. Without one, list the tasks below.

## Tasks

- [ ] <TBD: task> — verify by: <TBD: command or observable result>

## Dependencies and blockers

<TBD: what must happen first, and what is waiting on someone>

## Risks and unknowns

| Risk | Impact | Mitigation |
|---|---|---|
| <TBD> | <TBD> | <TBD> |

## Definition of done

<TBD: the conditions every task must meet, e.g. tests pass, docs updated, reviewed>

## Change log

- <TBD: date — what changed in this plan and why>

## Interview guide

Delete this section when every \`<TBD: …>\` is resolved, and set the Status to \`ready\`.
Ask one question at a time, offer a recommended answer, and write only what the user confirmed.

1. What must be true at the end of this phase, and by when?
2. What are the milestones, in order?
3. Do you use an issue tracker for tasks? If so, which one — then keep only milestones and links here.
4. Break each milestone into tasks. How will each task be verified?
5. What blocks or must come first?
6. What could go wrong, and what is the fallback?
7. When is a task really done?
`,

  review: `# Review

> Status: draft — fill this in through an interview (see the Interview guide at the end).

How changes are checked before they are called done. Reviewers, human or agent, use this file.

## Review scope

<TBD: what is reviewed (every change, only risky changes) and who reviews>

## Checklist

- [ ] Matches docs/spec.md and docs/intent.md, or the documents were updated in the same change
- [ ] Tests cover the changed behavior and pass; the exact command and result are reported
- [ ] Nothing outside the request changed; no speculative abstractions
- [ ] No credentials, tokens, or personal data committed
- [ ] Errors and edge cases at trust boundaries are handled
- [ ] Docs, plan, and architecture decisions are in sync with the code
- [ ] <TBD: project-specific checks>

## High-risk areas

<TBD: parts that always need extra care, e.g. money, permissions, data migration>

## Approval rules

<TBD: who must approve, and what blocks a merge>

## Report format

Findings first, ordered by severity. For each: file and line, the problem, and a concrete fix.
End with what was verified and what could not be.

## Review log

| Date | Scope | Findings | Decision |
|---|---|---|---|
| <TBD> | <TBD> | <TBD> | <TBD> |

## Interview guide

Delete this section when every \`<TBD: …>\` is resolved, and set the Status to \`ready\`.
Ask one question at a time, offer a recommended answer, and write only what the user confirmed.

1. Which changes need review, and who reviews them?
2. What quality bar applies: tests, lint, performance, style?
3. Which areas are risky and need extra care?
4. Who approves, and what blocks a merge?
5. Which project-specific checks belong on the checklist?
`,
}

const KO = {
  readme: `# <TBD: 프로젝트 이름>

> Status: draft — 인터뷰로 채워 주세요 (끝의 인터뷰 가이드 참고).

<TBD: 이 프로젝트가 무엇이고 누구를 위한 것인지 한 줄>

## 왜 만드는가

<TBD: 해결하는 문제를 두세 문장으로. 자세한 내용은 docs/intent.md에 둡니다>

## 빠른 시작

\`\`\`sh
# 설치:  <TBD>
# 실행:  <TBD>
# 테스트: <TBD>
\`\`\`

## 사용법

<TBD: 가장 흔한 사용 방법과 짧은 예시>

## 프로젝트 구조

<TBD: 주요 디렉터리와 각각이 담는 것>

## 문서

- [의도](docs/intent.md) — 왜 존재하는지, 누구를 위한 것인지, 성공이 무엇인지
- [명세](docs/spec.md) — 무엇을 해야 하는지
- [아키텍처](docs/architecture.md) — 어떻게 만들어졌는지
- [계획](docs/plan.md) — 무엇을 어떤 순서로 하는지
- [리뷰](docs/review.md) — 변경을 어떻게 검증하는지
- [AGENTS.md](AGENTS.md) — 코딩 에이전트용 지침

## 기여 방법

<TBD: 변경을 제안하는 방법, 브랜치·커밋 규칙>

## 라이선스

<TBD: 라이선스 이름>

## 인터뷰 가이드

모든 \`<TBD: …>\`를 채우면 이 절과 Status 줄을 지우세요.
질문은 한 번에 하나씩 하고, 추천 답을 함께 제시하고, 사용자가 확인한 내용만 적습니다.
빠른 시작에 넣기 전에 실제 명령을 실행해 확인합니다.

1. 이 프로젝트는 한 문장으로 무엇이고, 누구를 위한 것인가요?
2. 사용자가 가장 자주 하는 일 한 가지는 무엇인가요?
3. 정확한 설치·실행·테스트 명령은 무엇인가요? (직접 확인합니다.)
4. 기여는 어떻게 받고, 어떤 라이선스를 쓰나요?
`,

  intent: `# 의도 (Intent)

> Status: draft — 인터뷰로 채워 주세요 (끝의 인터뷰 가이드 참고).

이 프로젝트가 존재하는 이유. 명세·아키텍처·계획은 모두 이 문서에서 나옵니다.

## 목적

<TBD: 이것이 무엇이고 왜 지금 필요한가>

## 사용자

<TBD: 주 사용자와 각자가 겪는 문제>

## 성공 기준

<TBD: 성공했는지 어떻게 알 수 있나 — 가능하면 측정 가능하게>

## 하지 않는 것 (Non-goals)

<TBD: 일부러 하지 않는 것>

## 제약

<TBD: 기한, 예산, 플랫폼, 규제, 팀 규모, 기술 제한>

## 원칙

<TBD: 목표가 충돌할 때 정하는 기준. 예: "유연함보다 단순함">

## 열린 질문

- <TBD: 아직 정해지지 않은 것>

## 인터뷰 가이드

모든 \`<TBD: …>\`를 채우면 이 절을 지우고 Status를 \`ready\`로 바꾸세요.
질문은 한 번에 하나씩 하고, 추천 답을 함께 제시하고, 사용자가 확인한 내용만 적습니다.

1. 이 프로젝트는 무엇이고, 왜 지금 필요한가요?
2. 누가 쓰고, 각 사용자가 지금 겪는 가장 큰 문제는 무엇인가요?
3. 성공했는지 어떻게 알 수 있나요? 어떤 수치나 눈에 보이는 결과인가요?
4. 일부러 하지 않을 것은 무엇인가요?
5. 시간·예산·플랫폼·규칙·팀 중 어떤 제약이 있나요?
6. 두 목표가 충돌하면 어느 쪽이 이기나요?
`,

  spec: `# 명세 (Specification)

> Status: draft — 인터뷰로 채워 주세요 (끝의 인터뷰 가이드 참고).

시스템이 해야 하는 일. 요구사항마다 ID와 확인할 수 있는 완료 기준을 둡니다.
먼저 docs/intent.md를 읽으세요.

## 범위

<TBD: 이번 버전이 다루는 것>

## 범위 밖

<TBD: 이번 버전이 다루지 않는 것>

## 시나리오

1. <TBD: 핵심 시나리오 — 누가 무엇을 하고 무엇을 얻는가>

## 기능 요구사항

| ID | 요구사항 | 완료 기준 |
|---|---|---|
| FR-1 | <TBD> | <TBD: 통과·실패로 가를 수 있는 확인> |

## 비기능 요구사항

<TBD: 성능, 보안, 개인정보, 접근성, 호환성, 안정성 목표>

## 인터페이스와 데이터

<TBD: 입력, 출력, 데이터 모델, 외부 API, 파일 형식>

## 오류와 경계 상황

<TBD: 잘못된 입력, 실패, 빈 상태, 한도에서 어떻게 동작하나>

## 용어집

| 용어 | 뜻 |
|---|---|
| <TBD> | <TBD> |

## 인터뷰 가이드

모든 \`<TBD: …>\`를 채우면 이 절을 지우고 Status를 \`ready\`로 바꾸세요.
질문은 한 번에 하나씩 하고, 추천 답을 함께 제시하고, 사용자가 확인한 내용만 적습니다.

1. 사용자가 하는 가장 중요한 일 세 가지를 따라가 볼까요? 무엇으로 시작하고 무엇을 얻나요?
2. 기능마다 끝났는지 어떻게 확인하나요?
3. 무엇이 들어오고 나가나요? 데이터, 형식, 다른 시스템?
4. 문제가 생기거나 입력이 이상하면 어떻게 동작해야 하나요?
5. 속도·보안·개인정보·접근성·호환성 목표가 있나요?
6. 다음 버전으로 미루는 것은 무엇인가요?
`,

  architecture: `# 아키텍처 (Architecture)

> Status: draft — 인터뷰로 채워 주세요 (끝의 인터뷰 가이드 참고).

시스템이 어떻게, 왜 그렇게 만들어졌는가. 계속 사실로 남도록 짧게 유지합니다. 먼저 docs/spec.md를 읽으세요.

## 개요

<TBD: 시스템을 한 문단으로>

## 기술

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 / 런타임 | <TBD> | <TBD> |
| 프레임워크 / 라이브러리 | <TBD> | <TBD> |
| 저장소 | <TBD> | <TBD> |

## 구성요소

<TBD: 주요 구성요소 각각이 무엇을 책임지고 무엇을 하면 안 되는가>

\`\`\`mermaid
flowchart LR
  A[<TBD: 구성요소>] --> B[<TBD: 구성요소>]
\`\`\`

## 데이터 흐름

<TBD: 요청이나 데이터가 구성요소 사이를 어떻게 지나가나>

## 디렉터리 구조

<TBD: 주요 디렉터리와 무엇을 어디에 두는지에 대한 규칙>

## 외부 의존성

<TBD: 시스템이 기대는 서비스·API·패키지, 하나가 멈추면 어떻게 되는가>

## 결정 기록

| 날짜 | 결정 | 이유 | 버린 대안 |
|---|---|---|---|
| <TBD> | <TBD> | <TBD> | <TBD> |

## 빌드·테스트·배포

<TBD: 어떻게 빌드하고, 검증하고, 릴리스하나>

## 경계와 위험

<TBD: 계층 규칙, 알려진 약점, 함부로 바꾸면 안 되는 것>

## 인터뷰 가이드

모든 \`<TBD: …>\`를 채우면 이 절을 지우고 Status를 \`ready\`로 바꾸세요.
질문은 한 번에 하나씩 하고, 추천 답을 함께 제시하고, 사용자가 확인한 내용만 적습니다.
코드가 이미 있으면 먼저 읽고, 찾은 내용을 사용자에게 확인받으세요.

1. 어떤 언어·런타임·프레임워크를 쓰고, 이유는 무엇인가요?
2. 주요 구성요소는 무엇이고, 각각 무엇을 책임지나요?
3. 데이터는 어디에 저장되고 어떻게 흐르나요?
4. 어떤 외부 시스템과 패키지에 의존하나요?
5. 이미 내린 결정은 무엇이고, 이유는 무엇인가요?
6. 어떻게 빌드·테스트·배포하나요?
7. 지켜야 할 경계는 무엇이고, 바꾸기 위험한 곳은 어디인가요?
`,

  plan: `# 계획 (Plan)

> Status: draft — 인터뷰로 채워 주세요 (끝의 인터뷰 가이드 참고).

무엇을 어떤 순서로 하고, 각 단계를 어떻게 검증하는가. 작업과 같은 변경에서 함께 갱신합니다.
먼저 docs/spec.md와 docs/architecture.md를 읽으세요.

## 목표

<TBD: 현재 단계의 결과물과 기한>

## 마일스톤

| # | 마일스톤 | 완료 조건 | 목표일 |
|---|---|---|---|
| 1 | <TBD> | <TBD: 통과하는 확인> | <TBD> |

## 이슈 트래커

<TBD: 작업을 담는 이슈 트래커(이름과 링크), 없으면 "없음">

이슈 트래커를 쓰면 작업의 기준은 트래커입니다: 여기에는 목표, 마일스톤(각각 이슈 링크), 위험만 남기고 아래 작업 목록은 그 링크로 바꿉니다. 쓰지 않으면 아래에 작업을 적습니다.

## 작업

- [ ] <TBD: 작업> — 검증: <TBD: 명령 또는 눈에 보이는 결과>

## 의존성과 막힌 것

<TBD: 먼저 일어나야 하는 일, 누군가를 기다리는 일>

## 위험과 미지수

| 위험 | 영향 | 대응 |
|---|---|---|
| <TBD> | <TBD> | <TBD> |

## 완료의 정의

<TBD: 모든 작업이 만족할 조건. 예: 테스트 통과, 문서 갱신, 리뷰 완료>

## 변경 기록

- <TBD: 날짜 — 이 계획이 무엇이 왜 바뀌었는가>

## 인터뷰 가이드

모든 \`<TBD: …>\`를 채우면 이 절을 지우고 Status를 \`ready\`로 바꾸세요.
질문은 한 번에 하나씩 하고, 추천 답을 함께 제시하고, 사용자가 확인한 내용만 적습니다.

1. 이번 단계가 끝날 때 무엇이 참이어야 하고, 언제까지인가요?
2. 마일스톤은 무엇이고, 순서는 어떻게 되나요?
3. 작업에 이슈 트래커를 쓰나요? 쓴다면 어느 것인가요 — 그러면 여기에는 마일스톤과 링크만 둡니다.
4. 마일스톤마다 작업으로 쪼개 볼까요? 각 작업은 어떻게 검증하나요?
5. 무엇이 막고 있거나 먼저 와야 하나요?
6. 무엇이 잘못될 수 있고, 대안은 무엇인가요?
7. 작업은 언제 정말 끝난 것인가요?
`,

  review: `# 리뷰 (Review)

> Status: draft — 인터뷰로 채워 주세요 (끝의 인터뷰 가이드 참고).

변경을 끝났다고 부르기 전에 어떻게 확인하는가. 사람이든 에이전트든 리뷰어는 이 문서를 씁니다.

## 리뷰 범위

<TBD: 무엇을 리뷰하는가(모든 변경, 위험한 변경만)와 누가 하는가>

## 체크리스트

- [ ] docs/spec.md·docs/intent.md와 맞거나, 같은 변경에서 문서를 갱신했다
- [ ] 바뀐 동작을 테스트가 덮고 통과한다. 실행한 명령과 결과를 보고했다
- [ ] 요청 밖의 것을 바꾸지 않았다. 추측성 추상화가 없다
- [ ] 자격 증명·토큰·개인정보를 커밋하지 않았다
- [ ] 신뢰 경계의 오류와 경계 상황을 처리했다
- [ ] 문서·계획·아키텍처 결정이 코드와 맞는다
- [ ] <TBD: 프로젝트 고유 확인 항목>

## 위험 영역

<TBD: 항상 더 조심해야 하는 부분. 예: 돈, 권한, 데이터 이전>

## 승인 규칙

<TBD: 누가 승인해야 하고, 무엇이 병합을 막는가>

## 보고 형식

발견 사항을 심각도 순으로 먼저 씁니다. 각 항목마다 파일과 줄, 문제, 구체적인 수정안을 적습니다.
마지막에 확인한 것과 확인하지 못한 것을 적습니다.

## 리뷰 기록

| 날짜 | 범위 | 발견 사항 | 결정 |
|---|---|---|---|
| <TBD> | <TBD> | <TBD> | <TBD> |

## 인터뷰 가이드

모든 \`<TBD: …>\`를 채우면 이 절을 지우고 Status를 \`ready\`로 바꾸세요.
질문은 한 번에 하나씩 하고, 추천 답을 함께 제시하고, 사용자가 확인한 내용만 적습니다.

1. 어떤 변경에 리뷰가 필요하고, 누가 하나요?
2. 어떤 품질 기준이 적용되나요? 테스트, 린트, 성능, 스타일?
3. 위험해서 더 조심해야 하는 영역은 어디인가요?
4. 누가 승인하고, 무엇이 병합을 막나요?
5. 체크리스트에 넣을 프로젝트 고유 확인 항목은 무엇인가요?
`,
}

// 새 파일의 경로. 루트에는 README.md만 두고 나머지는 docs/ 아래에 둔다.
export const PROJECT_DOC_PATHS = {
  readme: 'README.md',
  intent: 'docs/intent.md',
  spec: 'docs/spec.md',
  architecture: 'docs/architecture.md',
  plan: 'docs/plan.md',
  review: 'docs/review.md',
}

export const PROJECT_DOCS = { en: EN, ko: KO }

// 생성 순서: 의도 → 명세 → 아키텍처 → 계획 → 리뷰 → README. 채우는 순서와 같다.
export function projectDocFiles(locale) {
  const docs = PROJECT_DOCS[locale] ?? EN
  return ['intent', 'spec', 'architecture', 'plan', 'review', 'readme'].map((key) => ({
    path: PROJECT_DOC_PATHS[key], template: docs[key],
  }))
}

// 사용자가 직접 쓴 파일에 빠진 절만 덧붙일 때(snippets.mjs) 같은 뜻으로 보는 흔한 제목.
// 영문 템플릿 제목을 키로 한다. 없으면 영문·한글 템플릿 제목만 같은 절로 본다.
// 의미가 같은 절을 못 알아보면 같은 내용이 두 번 들어가므로, 확신하는 것만 적는다.
export const PROJECT_DOC_ALIASES = {
  readme: {
    Why: ['Overview', 'About', 'Introduction', 'Motivation', 'Background', '소개', '개요', '배경'],
    'Quick start': ['Getting started', 'Installation', 'Install', 'Setup', 'Requirements', '시작하기', '설치', '시작'],
    Usage: ['Examples', 'Example', 'Features', '예시', '예제', '기능'],
    'Project structure': ['Structure', 'Directory structure', 'Layout', 'Repository layout', '디렉터리 구조', '구조'],
    Documentation: ['Docs', 'Further reading', 'Links', '문서'],
    Contributing: ['Contribution', 'Contribute', 'Development', '기여', '개발'],
    License: ['Licence', 'Licensing', '라이선스', '라이센스'],
  },
}

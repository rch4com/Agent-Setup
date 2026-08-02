// 커밋 메시지 템플릿(.gitmessage.txt) 항목의 단일 출처.
//
// 한 파일에 언어가 다른 두 판이 있다 — 그래서 항목도 둘이지만 대상 파일은
// 하나다. 둘을 동시에 고를 수 없게 하는 것은 TUI(state.mjs)와 --set
// (engine.mjs의 assertExclusive)이 exclusive 키로 맡는다. 여기서는 "내가 쓴
// 판이 지금 놓여 있는가"만 판정하고, 아니면 아무것도 건드리지 않는다.
//
// 항목 파일(lib/items/*.mjs)에 두지 않는 이유: loadItems가 그 디렉터리의
// 모든 .mjs를 항목으로 읽어 검증하므로, 보조 모듈이 하나라도 섞이면 로드가
// 통째로 실패한다.
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { normalizeBody } from './bootstrap/text.mjs'
import { repoPath, repoPathStrict } from './context.mjs'
import { LocalizedError, msg } from './i18n/index.mjs'

export const GITMESSAGE_REL = '.gitmessage.txt'
// 한 파일을 두고 다투는 항목들의 묶음 이름.
export const GITMESSAGE_EXCLUSIVE = 'gitmessage'

const CONFIG_KEY = 'commit.template'

// 이 저장소 루트의 .gitmessage.txt와 같은 내용이다 —
// test/items.gitmessage.test.mjs가 두 값이 갈리지 않게 고정한다.
export const GITMESSAGE_KO = `# Commit message template ( * 주석 처리(#)된 부분들은 커밋 메시지에 포함되지 않으니 참고해서 작성)
# <타입(<영역>)>: <주제>
#  - 타입은 필수 작성. 해당 커밋의 성격을 나타내며 타입의 종류 중 하나만 선택, 영어 소문자로 시작
#  - 영역은 필요 시 작성. 변경된 부분을 직접적으로 나타냄 ex) refactor(MemberService): loginMember 메소드 명을 login으로 수정
#  - 주제는 필수 작성. 최대 50글자까지, 끝에 마침표 금지, 한글로 간단 명료하게 작성, 현재형 사용
# 바로 밑줄에 작성

# 바로 아래 한 줄 공백 유지 (타입 본문의 분리를 위함)

################################
# <본문> - 필요시 작성. 한 줄당 최대 72자까지, 72자 초과시 줄바꿈, ”왜”, “무엇을 위해” 작업했는지에 초점을 맞춰 작성
# 바로 밑줄에 작성

# 바로 아래 한 줄 공백 유지 (본문과 바닥글의 분리를 위함)

################################
# <바닥글> - 필요시 작성
# 바로 밑줄에 작성 (이슈 해결 시에는 resolve: #99와 같이 작성)

######## [타입 리스트] ############
# feat: 새로운 기능 추가
# fix: 버그 수정
# style: 코드의 의미에 영향을 주지 않는 변경 사항(공백, 형식 지정, 세미콜론 누락 등), 클래스명 수정&가독성을 위해 변수명을 변경한 경우도 포함
# refactor: 버그 수정, 기능 추가도 아닌 코드 변경
# chore: 소스코드의 변경이 없으며 나열된 타입 이외 간단 변경
# add: feat 이외의 부수적인 코드, 라이브러리 등을 추가한 경우, 새로운 파일(Component나 Activity 등)을 생성한 경우도 포함
# remove: 코드, 파일을 삭제한 경우, 필요 없는 주석 삭제도 포함
# move: fix, refactor 등과 관계 없이 코드, 파일 등의 위치를 이동하는 작업만 수행한 경우
# comment: 필요한 주석을 추가, 수정한 경우( * 필요 없는 주석을 삭제한 경우는 remove)
# perf: 성능을 향상시키는 코드 변경
# test: 테스트 코드를 추가, 수정, 삭제한 경우
# docs: 문서를 추가, 수정한 경우
# design: CSS 등 사용자 UI 디자인을 추가, 수정한 경우
# revert: 이전 커밋을 되돌린 경우
# !BREAKING CHANGE: 커다란 API 변경의 경우 (MAJOR 버전과 상관 관계)
# !HOTFIX: 급하게 치명적인 버그를 고쳐야하는 경우
######## [커밋 메시지 예시] #########
# fix: 로그인 기능 구현
#
# 로그인 시 JWT 발급
#
# resolve: #232
# ref: #122
# related to: #30, #50
# ------------------
# [* 지켜야 할 보편적 규칙]
#  1. 언어는 한국어를 사용한다.
#    - 예외 사항) 최초 커밋 메시지는 “Initial commit”으로 한다.
#  2. 문장의 구성
#    1) 문장은 간결하게 구성한다.
#    2) 현재형을 사용한다.
#  3. 작성한 당사자가 아닌 제 3자가 이해할 수 있도록 작성한다.
#  4. 단순한 문장일수록 좋다.
# ------------------
# [* 커밋 타이밍]
#  - 의미 있는 코드의 변화가 있다면 커밋을 진행한다.
#  - 의미가 있다면 사소한 것을 커밋 하는 것은 전혀 잘못된 것이 아니다.
#  - 다만 의미 없는 잦은 커밋은 히스토리 추적에 불편함을 주므로 의미 없는 커밋은 자제한다.
################################
`

// 한국어판을 줄 단위로 옮긴 것이다. 타입 목록과 구획선은 같은 자리에 둔다 —
// 두 판을 오가도 커밋 히스토리의 모양이 달라지지 않아야 한다.
export const GITMESSAGE_EN = `# Commit message template ( * Lines that start with # are comments and never reach the commit message)
# <type(<scope>)>: <subject>
#  - Type is required. It names the nature of this commit. Pick exactly one from the list below, lowercase English
#  - Scope is optional. It points straight at what changed ex) refactor(MemberService): rename loginMember to login
#  - Subject is required. 50 characters at most, no trailing period, plain and clear, present tense
# Write it on the line right below

# Keep one blank line right below (it separates the subject from the body)

################################
# <Body> - optional. 72 characters per line at most, wrap past that, focus on "why" and "what for"
# Write it on the line right below

# Keep one blank line right below (it separates the body from the footer)

################################
# <Footer> - optional
# Write it on the line right below (for a resolved issue, write resolve: #99)

######## [Type list] ############
# feat: add a new feature
# fix: fix a bug
# style: changes that do not affect the meaning of the code (whitespace, formatting, missing semicolons), including class or variable renames made for readability
# refactor: a code change that is neither a bug fix nor a new feature
# chore: no source change; small changes outside the types listed here
# add: supporting code, libraries and the like added outside feat, including brand new files (a Component, an Activity)
# remove: code or files deleted, including the removal of comments that are no longer needed
# move: only moving code or files around, unrelated to fix, refactor and the rest
# comment: a needed comment added or reworded ( * deleting a comment that is not needed is remove)
# perf: a code change that improves performance
# test: test code added, changed or deleted
# docs: documentation added or changed
# design: user-facing UI design added or changed (CSS and the like)
# revert: an earlier commit rolled back
# !BREAKING CHANGE: a large API change (tied to the MAJOR version)
# !HOTFIX: an urgent fix for a critical bug
######## [Example commit message] #########
# fix: implement the login feature
#
# Issue a JWT on login
#
# resolve: #232
# ref: #122
# related to: #30, #50
# ------------------
# [* Universal rules]
#  1. Write in English.
#    - Exception) the very first commit message of a repository is "Initial commit".
#  2. Sentence shape
#    1) Keep sentences short.
#    2) Use the present tense.
#  3. Write so that a third party, not only the author, can follow it.
#  4. The simpler the sentence, the better.
# ------------------
# [* When to commit]
#  - Commit whenever there is a meaningful change in the code.
#  - Committing something small is not wrong at all as long as it means something.
#  - Frequent meaningless commits make the history hard to follow, so hold those back.
################################
`

export const GITMESSAGE_BODIES = [GITMESSAGE_EN, GITMESSAGE_KO].map(normalizeBody)

function readCurrent(root) {
  try {
    return readFileSync(repoPath(root, GITMESSAGE_REL), 'utf8')
  } catch {
    return null
  }
}

// 저장소 설정만 본다. --local이 없으면 전역·시스템 설정까지 함께 읽혀,
// 사용자가 ~/.gitconfig에 같은 값을 둔 것만으로 이 저장소가 설치된 것처럼
// 보인다 — 이 도구는 저장소 안만 건드리므로 판정도 저장소 안만 봐야 한다.
// 값이 없으면 git이 종료 코드 1로 끝나므로 예외가 곧 "설정 없음"이다.
// git이 아예 없어도 같은 길로 떨어진다 — 그때는 상태 판정만 보수적으로
// 흐를 뿐, 화면이 죽지는 않는다.
function pointsHere(root) {
  try {
    const out = execFileSync('git', ['config', '--local', '--get', CONFIG_KEY], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.trim() === GITMESSAGE_REL
  } catch {
    return false
  }
}

// supports를 두지 않는다. 이 항목은 CLI 배선이 아니라 저장소 규약이라
// "10개 중 몇 개"라는 물음 자체가 성립하지 않는다 — 힌트의 커버리지 줄,
// 상세 패널의 배선표, CLI 필터가 모두 supports 없는 항목을 건너뛴다.
export function defineGitmessage({ id, label, body, note }) {
  const wanted = normalizeBody(body)

  return {
    id,
    category: 'config',
    label,
    scope: 'project',
    group: '__commit',
    exclusive: GITMESSAGE_EXCLUSIVE,
    // 이 항목이 손대는 파일. 그룹 헤더가 없는 평평한 목록에서도 무엇이
    // 놓이는지 보이고, '.gitmessage'로 검색해도 걸린다.
    target: GITMESSAGE_REL,
    unsupported: {},
    note,

    async detect({ root }) {
      const current = readCurrent(root)
      if (current === null || normalizeBody(current) !== wanted) return { status: 'absent' }
      // 파일만 놓여 있고 git이 그것을 모르면 템플릿은 한 번도 뜨지 않는다.
      // 설치됨으로 찍으면 "왜 안 뜨지"를 사용자가 혼자 풀어야 한다.
      return pointsHere(root) ? { status: 'installed' } : { status: 'partial', detail: msg('item.gitmessage.unregistered') }
    },

    async install({ root, dryRun, exec, log = () => {}, t }) {
      const current = readCurrent(root)
      // 손으로 쓴 템플릿은 덮지 않는다 — 이 저장소의 다른 모든 쓰기가 지키는
      // 규칙이다. 우리가 아는 두 판 사이를 오가는 것만 덮어쓰기로 본다.
      if (current !== null && !GITMESSAGE_BODIES.includes(normalizeBody(current))) {
        throw new LocalizedError('error.gitmessageForeign', { path: GITMESSAGE_REL })
      }
      if (dryRun) log(t('log.gitmessage.write', { path: GITMESSAGE_REL }))
      else writeFileSync(repoPathStrict(root, GITMESSAGE_REL), wanted, { encoding: 'utf8' })

      const r = await exec('git', ['config', '--local', CONFIG_KEY, GITMESSAGE_REL], { cwd: root })
      if (!r.ok) throw new LocalizedError('error.gitmessageConfig', { output: r.output })
    },

    async uninstall({ root, dryRun, exec, log = () => {}, t }) {
      const current = readCurrent(root)
      // 같은 적용 안에서 다른 언어 판이 먼저 설치돼 파일을 갈아 끼웠을 수
      // 있다(en 설치 → ko 제거 순서). 그때 지우면 방금 쓴 파일이 날아간다 —
      // 내용이 내 판일 때만 손댄다.
      if (current === null || normalizeBody(current) !== wanted) return
      if (dryRun) log(t('log.gitmessage.remove', { path: GITMESSAGE_REL }))
      else rmSync(repoPathStrict(root, GITMESSAGE_REL), { force: true })

      // 남의 값이나 빈 값에 --unset을 걸면 git이 실패를 돌려준다.
      if (pointsHere(root)) await exec('git', ['config', '--local', '--unset', CONFIG_KEY], { cwd: root })
    },
  }
}

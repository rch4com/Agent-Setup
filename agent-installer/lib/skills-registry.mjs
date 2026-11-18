// 공유 스킬 디렉터리(.agents/skills)와 레지스트리 잠금 파일을 읽고 정리하는
// 보조 함수. 감지(probe)와 레지스트리 스킬 레시피가 함께 쓴다.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoPath, repoPathStrict } from './context.mjs'
import { escapeRegExp, isSafeSegment } from './untrusted.mjs'

// 이 저장소가 공유 스킬 자리로 쓰는 디렉터리. vercel-labs/skills 레지스트리의
// `--agent universal` 프로젝트 경로와 같은 값이다 — 그래서 레지스트리 설치가
// 우리 배선 위에 그대로 얹힌다.
export const SHARED_SKILLS = '.agents/skills'

function skillDirs(root) {
  const dir = repoPath(root, SHARED_SKILLS)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((name) => {
    try {
      return statSync(join(dir, name)).isDirectory()
    } catch {
      return false
    }
  })
}

// 설치된 디렉터리 이름이 스킬 이름과 다를 수 있다(레지스트리는 SKILL.md의
// frontmatter name으로 고르는데, 저장소의 폴더 이름은 다른 경우가 있다 —
// taste-skill/이 design-taste-frontend를 담는 식이다). 이름이 같은 디렉터리를
// 먼저 보고, 없으면 frontmatter를 읽어 찾는다. 디렉터리 이름만 보면 설치해
// 놓고도 계속 '미설치'로 읽힌다.
export function findSkillDir(root, skill) {
  const base = repoPath(root, SHARED_SKILLS)
  if (existsSync(join(base, skill, 'SKILL.md'))) return skill
  return findSkillDirByName(root, skill)
}

// frontmatter 이름으로만 폴더를 찾는다. 반환값은 스캔한 폴더 이름(안전한 세그먼트)이라,
// 경로로 쓸 수 없는 이름(`stitch::x` — 레지스트리가 `stitch-x`로 바꿔 저장)도 안전하게 찾는다.
export function findSkillDirByName(root, skill) {
  const base = repoPath(root, SHARED_SKILLS)
  for (const name of skillDirs(root)) {
    const file = join(base, name, 'SKILL.md')
    if (!existsSync(file)) continue
    const head = readFileSync(file, 'utf8').slice(0, 2000)
    if (new RegExp(`^name:\\s*['"]?${escapeRegExp(skill)}['"]?\\s*$`, 'm').test(head)) return name
  }
  return null
}

// 잠금 파일의 이름은 상류 SKILL.md frontmatter에서 온다 — 신뢰 경계 밖이다.
// `npx skills remove <이름>`의 인자이자 `.agents/skills/<이름>` 경로가 되므로,
// 플래그로 읽히는 선행 대시와 경로 구분자·상위 이동은 어느 쪽으로도 쓸 수 없다.
export function isSafeSkillName(name) {
  return isSafeSegment(name) && !name.startsWith('-')
}

// 레지스트리가 저장소 루트에 남기는 잠금 파일. 스킬 이름마다 어느 출처에서
// 왔는지를 적어 두므로, 한 상류가 여러 스킬을 깔았을 때 "우리가 넣은 것"만
// 골라 지울 수 있는 유일한 근거다.
export const SKILLS_LOCK = 'skills-lock.json'

// 잠금 파일의 source는 `owner/repo`로 정규화돼 있고 항목은 URL을 넘긴다.
export function sourceKey(source) {
  return String(source).replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '')
}

function readLock(root) {
  const file = repoPath(root, SKILLS_LOCK)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    // 잠금 파일이 깨졌다고 제거를 막지는 않는다 — 디렉터리 스캔 폴백이 있다.
    return null
  }
}

export function lockedSkills(root, source) {
  const want = sourceKey(source)
  return Object.entries(readLock(root)?.skills ?? {})
    .filter(([, v]) => sourceKey(v?.source ?? '') === want)
    .map(([name]) => name)
}

// 레지스트리의 remove는 디렉터리도, 잠금 파일의 항목도 남긴다(실측). 디렉터리는
// 아래에서 우리가 지우는데 잠금 항목을 그대로 두면 파일이 "설치돼 있다"고
// 거짓말한다 — 커밋해서 팀과 나누는 파일이라, 동료가 experimental_install로
// 복원하면 지운 스킬이 되살아난다.
export function pruneLock(root, names) {
  const parsed = readLock(root)
  const skills = parsed?.skills
  if (!skills) return
  const gone = names.filter((n) => Object.hasOwn(skills, n))
  if (gone.length === 0) return
  for (const n of gone) delete skills[n]
  const file = repoPathStrict(root, SKILLS_LOCK)
  // 남은 스킬이 없으면 파일째 지운다. 이 파일은 레지스트리가 만든 산출물이라
  // 빈 껍데기를 남기면 우리가 만든 흔적이 저장소에 계속 남는다.
  if (Object.keys(skills).length === 0) rmSync(file, { force: true })
  else writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`)
}

// 레지스트리(skills@1.8)가 잠금 파일의 computedHash를 만드는 방식 그대로다 —
// 경로 정렬, 경로·길이·내용을 NUL로 잇고, 텍스트의 CRLF는 LF로 본다.
// 상류가 이 방식을 바꾸면 항목이 늘 '갱신 있음'으로 읽힌다. 그때 치르는 값은
// 같은 내용을 한 번 더 받는 것뿐이라 조용히 낡는 쪽보다 낫다.
const HASH_SKIP = new Set(['metadata.json', '.git', '__pycache__', '__pypackages__'])
export function skillFolderHash(files) {
  const lf = (b) => (b.includes(0) || !b.includes('\r\n') ? b : Buffer.from(b.toString('latin1').replaceAll('\r\n', '\n'), 'latin1'))
  const entries = files
    .filter((f) => !f.path.split('/').some((part) => HASH_SKIP.has(part)))
    .map((f) => ({ path: Buffer.from(f.path, 'utf8'), content: lf(f.content) }))
    .sort((a, b) => Buffer.compare(a.path, b.path))
  const hash = createHash('sha256')
  for (const { path, content } of entries) {
    hash.update(path); hash.update('\0'); hash.update(String(content.length)); hash.update('\0'); hash.update(content)
  }
  return hash.digest('hex')
}

const UPSTREAM_TIMEOUT_MS = 10 * 1000

// 저장소에 깐 스킬보다 GitHub 기본 브랜치의 원본이 새로운가. 잠금 파일에
// 적힌 해시와 상류 폴더를 같은 방식으로 해시해 비교한다. 오프라인·API 한도·
// 잠금 항목 없음은 모두 "새 것 없음"이다 — 감지가 네트워크 때문에 설치본을
// 미설치로 뒤집으면 안 된다.
export async function upstreamChanged(root, skill, { fetchImpl = fetch } = {}) {
  const entry = readLock(root)?.skills?.[skill]
  if (!entry?.computedHash || entry.sourceType !== 'github' || !entry.skillPath) return false
  const repo = sourceKey(entry.source)
  const dir = entry.skillPath.split('/').slice(0, -1).join('/')
  const prefix = dir ? `${dir}/` : ''
  const get = async (url) => {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return res
  }
  try {
    const tree = await (await get(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`)).json()
    if (tree.truncated) return false
    const blobs = tree.tree.filter((n) => n.type === 'blob' && n.path.startsWith(prefix))
    const files = await Promise.all(blobs.map(async (n) => ({
      path: n.path.slice(prefix.length),
      content: Buffer.from(await (await get(`https://raw.githubusercontent.com/${repo}/${tree.sha}/${n.path}`)).arrayBuffer()),
    })))
    return files.length > 0 && skillFolderHash(files) !== entry.computedHash
  } catch {
    return false
  }
}

import { execFile } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { LocalizedError } from '../i18n/index.mjs'
import { onPath } from '../probe.mjs'
import { defineRecipe } from '../recipe.mjs'
import { mustRun, skillsAdd, withApp } from '../recipe-helpers.mjs'
import { SHARED_SKILLS, findSkillDir } from '../skills-registry.mjs'
// citrolabs/ego-lite(저장소 MIT, 앱은 별도 무료 배포). 사람과 에이전트가 함께
// 쓰는 Chromium 브라우저 앱이고, 스킬(skills/ego-browser)은 앱이 PATH에
// 등록하는 ego-browser 명령을 부르는 지침이다 — 앱이 없으면 함께 깐다.
//
// 상류에 패키지 관리자 경로가 없다(2026-11-12 확인, skills/ego-browser/
// references/install*.md). Windows는 CDN의 설치기를 받아 실행하고, macOS는
// 스킬에 딸린 상류 install.sh(DMG를 받아 /Applications에 복사)를 돌린다.
// Linux 빌드는 아직 없다.
//
// ego-browser는 앱을 처음 열어 온보딩을 마쳐야 PATH에 생긴다. 그래서 감지는
// 명령만 보지 않고 앱 자체도 본다: macOS는 .app 위치, Windows는 설치기가
// Chromium 업데이터(UpdaterSetup, 0.6.2.10 실측)라 설치 경로가 고정이 아니어서
// 제거 목록의 표시 이름으로 찾는다.
const WINDOWS_SETUP = 'https://cdn.ego.app/setup/windows/x64/egoliteSetup-Y7MbxKIuhzFB.exe'
const APP_NAME = 'ego lite'
const UNINSTALL_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
]

async function windowsInstalled() {
  for (const key of UNINSTALL_KEYS) {
    try {
      const { stdout } = await promisify(execFile)('reg', ['query', key, '/s', '/f', APP_NAME, '/d'], { timeout: 10000 })
      if (/DisplayName\s+REG_SZ\s+ego lite/i.test(stdout)) return true
    } catch { /* 일치가 없으면 reg가 실패로 끝난다 */ }
  }
  return false
}

async function present() {
  if (onPath('ego-browser')) return true
  if (process.platform === 'darwin') {
    return ['/Applications', join(homedir(), 'Applications')].some((d) => existsSync(join(d, `${APP_NAME}.app`)))
  }
  if (process.platform === 'win32') return windowsInstalled()
  return false
}

async function install({ root, exec }) {
  if (process.platform === 'win32') {
    const res = await fetch(WINDOWS_SETUP)
    if (!res.ok) throw new LocalizedError('error.appInstall', { command: `GET ${WINDOWS_SETUP}`, output: `HTTP ${res.status}` })
    const file = join(tmpdir(), 'egoliteSetup.exe')
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    // 온라인 설치기라 본체를 받는 동안 기다린다. 끝나면 앱이 뜬다.
    await mustRun(exec, file, [])
    return
  }
  if (process.platform === 'darwin') {
    // 방금 깐 스킬에 딸린 상류 스크립트 — 저장소 범위면 .agents/skills, 전역이면 ~/.agents/skills.
    const dir = findSkillDir(root, 'ego-browser')
    const script = [dir && join(root, SHARED_SKILLS, dir), join(homedir(), SHARED_SKILLS, 'ego-browser')]
      .filter(Boolean).map((d) => join(d, 'scripts', 'install.sh')).find((f) => existsSync(f))
    if (!script) throw new LocalizedError('error.appInstall', { command: 'sh skills/ego-browser/scripts/install.sh', output: 'install.sh not found' })
    await mustRun(exec, 'sh', [script])
    return
  }
  throw new LocalizedError('error.appUnsupported', { app: APP_NAME, platform: process.platform })
}

export default defineRecipe({
  id: 'skill.ego-lite', category: 'skill', label: 'ego lite', group: '__service',
  note: 'item.skill.ego-lite.note',
  verified: '2026-11-12',
  ...withApp(
    skillsAdd({ source: 'https://github.com/citrolabs/ego-lite', skill: 'ego-browser' }),
    { describe: `install the ${APP_NAME} app if missing (Windows: run ${WINDOWS_SETUP}; macOS: upstream install.sh)`, present, install },
  ),
})

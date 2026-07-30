import { repoPath, repoPathStrict } from './context.mjs'
import { readJson, setKey, removeKey } from './jsonfile.mjs'

const SETTINGS = '.claude/settings.json'

function readSettings(root) {
  return readJson(repoPath(root, SETTINGS)) ?? {}
}

// 쓰기 경로만 링크 이탈까지 검사한다 — 저장소 안 `.claude`가 홈을 가리키는
// Junction이면 어휘적 검사는 통과하고 글로벌 settings.json이 수정된다.
// clis.mjs의 add·remove, bootstrap의 apply.mjs와 같은 규칙.
function settingsFile(root) {
  return repoPathStrict(root, SETTINGS)
}

function enabledList(settings) {
  const ep = settings.enabledPlugins
  if (Array.isArray(ep)) return ep
  if (ep && typeof ep === 'object') return Object.keys(ep).filter((k) => ep[k])
  return []
}

export function isPluginEnabled(root, ids) {
  const list = enabledList(readSettings(root))
  return ids.some((id) => list.includes(id))
}

export function enablePlugin(root, id, marketplace) {
  const file = settingsFile(root)
  const settings = readSettings(root)
  if (Array.isArray(settings.enabledPlugins)) {
    if (!settings.enabledPlugins.includes(id)) {
      setKey(file, ['enabledPlugins', settings.enabledPlugins.length], id)
    }
  } else {
    setKey(file, ['enabledPlugins', id], true)
  }
  if (marketplace) {
    setKey(file, ['extraKnownMarketplaces', marketplace.name], {
      source: { source: 'github', repo: marketplace.repo },
    })
  }
}

export function disablePlugin(root, ids) {
  const file = settingsFile(root)
  const settings = readSettings(root)
  if (Array.isArray(settings.enabledPlugins)) {
    const kept = settings.enabledPlugins.filter((e) => !ids.includes(e))
    setKey(file, ['enabledPlugins'], kept)
  } else if (settings.enabledPlugins) {
    for (const id of ids) removeKey(file, ['enabledPlugins', id])
  }
  // 제거한 플러그인이 쓰던 마켓플레이스만 정리 대상으로 삼는다 (무관한 사용자 항목 보존).
  const candidates = new Set(ids.map((id) => id.slice(id.indexOf('@') + 1)))
  const after = readSettings(root)
  const remaining = enabledList(after).map((e) => e.slice(e.indexOf('@') + 1))
  for (const mkt of candidates) {
    if (!remaining.includes(mkt) && after.extraKnownMarketplaces?.[mkt] !== undefined) {
      removeKey(file, ['extraKnownMarketplaces', mkt])
    }
  }
}

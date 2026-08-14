import { definePlugin } from '../catalog.mjs'
import { CLI_IDS } from '../clis.mjs'
import { msg } from '../i18n/index.mjs'
// 레지스트리 경로(`npx skills add`)도 열려 있지만 쓰지 않는다 — ECC의 skills/에는
// 284개가 들어 있어 `--skill` 없이 넣으면 공유 스킬 디렉터리를 통째로 덮는다
// (2026-08-15 저장소 트리로 실측). 플러그인은 프로필을 상류가 관리하므로
// 저장소에 남는 파일이 없다.
//
// 미배선 사유는 CLI마다 갈린다. Codex만 상류가 네이티브 플러그인을 주는데,
// README가 못을 박는다 — "Codex stores one enabled plugin state in the active
// CODEX_HOME; it does not offer Claude's user, project, and local scopes."
// 나머지는 ./install.sh --target으로 열려 있고 Gemini(.gemini/)·Kimi(.kimi-code/)는
// 프로젝트 로컬이기까지 하다. 그쪽을 막는 것은 스코프가 아니라 284개라는 규모다.
export default definePlugin({
  id: 'plugin.ecc', label: 'ECC', group: '__flow',
  installId: 'ecc@ecc',
  detectIds: ['ecc@ecc'],
  marketplace: { name: 'ecc', repo: 'affaan-m/ECC' },
  note: 'item.plugin.ecc.note',
  unsupported: Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [
      c,
      c === 'codex' ? msg('item.unsupported.eccCodexHome') : msg('item.unsupported.eccScale'),
    ]),
  ),
})

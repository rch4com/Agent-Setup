import { definePlugin } from '../catalog.mjs'
// 레지스트리 경로(`npx skills add`)도 열려 있지만 쓰지 않는다 — ECC의 skills/에는
// 281개가 들어 있어 `--skill` 없이 넣으면 공유 스킬 디렉터리를 통째로 덮는다.
// 플러그인은 프로필을 상류가 관리하므로 저장소에 남는 파일이 없다.
export default definePlugin({
  id: 'plugin.ecc', label: 'ECC', group: '__flow',
  installId: 'ecc@ecc',
  detectIds: ['ecc@ecc'],
  marketplace: { name: 'ecc', repo: 'affaan-m/ECC' },
  note: 'item.plugin.ecc.note',
})

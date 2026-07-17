import { definePlugin } from '../catalog.mjs'
export default definePlugin({
  id: 'plugin.mattpocock-skills', label: 'Matt Pocock skills',
  installId: 'mattpocock-skills@mattpocock',
  detectIds: ['mattpocock-skills@mattpocock'],
  marketplace: { name: 'mattpocock', repo: 'mattpocock/skills' },
  note: '엔지니어링·생산성 스킬 22종 (tdd, code-review, research 등)',
})

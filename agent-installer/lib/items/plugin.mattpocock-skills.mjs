import { definePlugin } from '../catalog.mjs'
export default definePlugin({
  id: 'plugin.mattpocock-skills', label: 'Matt Pocock skills', group: '__flow',
  installId: 'mattpocock-skills@mattpocock',
  detectIds: ['mattpocock-skills@mattpocock'],
  marketplace: { name: 'mattpocock', repo: 'mattpocock/skills' },
  note: 'item.plugin.mattpocock-skills.note',
})

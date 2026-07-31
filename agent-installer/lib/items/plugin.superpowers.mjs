import { definePlugin } from '../catalog.mjs'
export default definePlugin({
  id: 'plugin.superpowers', label: 'superpowers',
  installId: 'superpowers@claude-plugins-official',
  detectIds: ['superpowers@claude-plugins-official', 'superpowers@superpowers-marketplace'],
  note: 'item.plugin.superpowers.note',
})

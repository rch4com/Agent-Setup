import { definePlugin } from '../catalog.mjs'
export default definePlugin({
  id: 'plugin.bkit', label: 'bkit', group: '__flow',
  installId: 'bkit@bkit-marketplace',
  detectIds: ['bkit@bkit-marketplace'],
  marketplace: { name: 'bkit-marketplace', repo: 'popup-studio-ai/bkit-claude-code' },
})

import { defineRegistrySkill } from '../catalog.mjs'
export default defineRegistrySkill({
  id: 'skill.karpathy', label: 'Karpathy guidelines', group: '__flow',
  source: 'https://github.com/multica-ai/andrej-karpathy-skills',
  skill: 'karpathy-guidelines',
  note: 'item.skill.karpathy.note',
})

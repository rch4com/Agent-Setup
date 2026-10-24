import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
export default defineRecipe({
  id: 'skill.karpathy', category: 'skill', label: 'Karpathy guidelines', group: '__flow',
  note: 'item.skill.karpathy.note',
  ...skillsAdd({ source: 'https://github.com/multica-ai/andrej-karpathy-skills', skill: 'karpathy-guidelines' }),
})

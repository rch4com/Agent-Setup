import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
export default defineRecipe({
  id: 'skill.prompt-master', category: 'skill', label: 'Prompt Master', group: '__flow',
  note: 'item.skill.prompt-master.note',
  ...skillsAdd({ source: 'https://github.com/nidhinjs/prompt-master', skill: 'prompt-master' }),
})

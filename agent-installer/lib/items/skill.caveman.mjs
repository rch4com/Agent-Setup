import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
export default defineRecipe({
  id: 'skill.caveman', category: 'skill', label: 'caveman', group: '__token',
  note: 'item.skill.caveman.note',
  ...skillsAdd({ source: 'https://github.com/JuliusBrussee/caveman', skill: 'caveman' }),
})

import { defineGitmessage, GITMESSAGE_EN } from '../gitmessage.mjs'

export default defineGitmessage({
  id: 'config.gitmessage.en',
  // 두 판을 가르는 낱말을 맨 앞에 둔다 — 라벨 자리(24칸)에서 눈이 먼저 닿는
  // 곳이고, 그룹 헤더가 이미 "커밋 템플릿"을 말하고 있어 뒤쪽은 확인용이다.
  label: 'English commit template',
  body: GITMESSAGE_EN,
  note: 'item.config.gitmessage.en.note',
})

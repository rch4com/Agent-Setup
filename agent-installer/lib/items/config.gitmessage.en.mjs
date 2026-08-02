import { defineGitmessage, GITMESSAGE_EN } from '../gitmessage.mjs'

export default defineGitmessage({
  id: 'config.gitmessage.en',
  // 목록의 라벨 자리는 24칸이다 — 'Commit template (English)'는 한 칸이 넘쳐
  // 잘린다. 이 도구가 이미 쓰는 --lang en|ko 표기를 따르고, 전문은 note가 편다.
  label: 'Commit template (EN)',
  body: GITMESSAGE_EN,
  note: 'item.config.gitmessage.en.note',
})

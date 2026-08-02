import { defineGitmessage, GITMESSAGE_KO } from '../gitmessage.mjs'

export default defineGitmessage({
  id: 'config.gitmessage.ko',
  // 라벨은 우리 카탈로그 데이터라 두 로케일에서 같은 값이 나간다 — 영어 화면에
  // 한글('한국어')이 새면 그 자리는 번역 누락으로 읽힌다(i18n.en.test.mjs).
  // 어느 언어판인지는 라벨의 (EN)·(KO)가, 무엇이 놓이는지는 note가 말한다.
  label: 'Commit template (KO)',
  body: GITMESSAGE_KO,
  note: 'item.config.gitmessage.ko.note',
})

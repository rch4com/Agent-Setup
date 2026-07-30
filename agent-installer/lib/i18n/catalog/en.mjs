// 기준 카탈로그 — 모든 키의 원본이자 폴백이다.
// ko.mjs는 이 키 집합을 그대로 따라야 한다. 키·자리·타입이 어긋나는 순간
// i18n.test.mjs가 실패한다.
//
// 값은 문자열 또는 문자열 배열(여러 줄)만 쓴다. 함수를 두면 카탈로그가
// 데이터가 아니게 되어 완전성 검사를 할 수 없다.
export default {
  // 언어 이름은 어떤 화면에서 보든 자기 언어로 쓴다 — 두 카탈로그에서 값이 같다.
  'locale.en': 'English',
  'locale.ko': '한국어',

  'error.notGitRepo': 'Run this inside a Git repository.',
  'error.pathOutsideRepo': 'Cannot write outside the repository: {path}',
}

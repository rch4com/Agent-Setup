// 신뢰 경계 밖에서 온 문자열의 가드. 잎 모듈이다 — bootstrap/apply.mjs가
// 쓰므로 의존성이 들어오면 npm install 없이 도는 부트스트랩
// (bootstrap.isolation.test.mjs)이 깨지고, lib/catalog.mjs가 쓰므로 design-md
// 아래에 두면 design-md를 뺀 "의존성 없는 트리"(deps.test.mjs)에서 --list가
// 원시 "Cannot find module"로 죽는다.
//
// 이 저장소의 방어는 "쓰기 경로만 엄격 검사"인데, 그 규칙은 읽은 데이터가
// 경로·명령 인자·정규식이 되는 자리를 각각 덮지는 않는다. 그래서 그 셋을
// 한 곳에 모아 둔다 — 원격 README의 항목 이름, 잠금 파일의 스킬 이름,
// 디렉터리 스캔의 폴더 이름이 전부 여기를 지난다.

// 경로 세그먼트 하나로 안전한 이름인지 본다. 한글 등 유니코드는 허용하되
// 경로 구분자·상위 이동·Windows 금지 문자·제어문자는 막는다.
export function isSafeSegment(text) {
  const value = String(text ?? '')
  // 선행·후행 점은 숨김 파일이자 Windows에서 다루기 어려운 이름이다('.', '..' 포함).
  if (!value || value.startsWith('.') || value.endsWith('.')) return false
  // eslint-disable-next-line no-control-regex
  return !/[\\/:*?"<>|\x00-\x1f]/.test(value)
}

// RegExp 본문에 넣기 전의 이스케이프. 잠금 파일의 스킬 이름처럼 상류에서 온
// 문자열이 `(`를 품으면 RegExp 생성 자체가 던져 제거가 중간에 죽었다.
export function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

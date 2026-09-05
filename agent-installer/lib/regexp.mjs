// 외부에서 온 문자열을 RegExp 본문에 넣기 전의 이스케이프. 잎 모듈이다 —
// bootstrap/apply.mjs가 쓰므로 의존성이 들어오면 npm install 없이 도는
// 부트스트랩(bootstrap.isolation.test.mjs)이 깨진다.
//
// 이 저장소의 방어는 "쓰기 경로만 엄격 검사"인데, 그 규칙은 읽은 데이터를
// 코드(정규식)로 쓰는 자리를 덮지 않는다. 잠금 파일의 스킬 이름처럼 상류에서
// 온 문자열이 `(`를 품으면 RegExp 생성 자체가 던져 제거가 중간에 죽었다.
export function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 플러그인 항목 라벨에 설치 범위 접미사를 붙인다. 목록 밖(검토·진행·결과
// 화면)에는 범위 그룹 헤더가 없어, 같은 이름의 두 판(superpowers 저장소/전역)을
// 이 접미사만이 가른다. import가 없는 잎 모듈이어야 한다 — install.mjs가
// 정적으로 당기므로, 의존성이 들어오면 npm install 없이 도는 부트스트랩
// (bootstrap.isolation.test.mjs)이 깨진다.
export function scopedLabel(item, t) {
  if (item?.category !== 'plugin') return item?.label ?? ''
  return `${item.label} ${t(`label.scope.${item.scope ?? 'project'}`)}`
}

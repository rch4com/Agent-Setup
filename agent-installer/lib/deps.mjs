// 선택적 의존성 로딩. 부트스트랩은 npm install 없이 돌아야 하므로
// jsonc-parser·smol-toml에 닿는 모듈은 전부 동적 import로 가져오고,
// 없을 때는 Node의 원시 메시지 대신 설치 방법을 안내한다.

export const DEPS_HINT =
  '이 기능에는 의존성이 필요합니다. 다음 중 하나를 실행하세요:\n' +
  '  ./setup-agents.sh --tui\n' +
  '  npm install --prefix agent-installer'

export async function withDeps(load) {
  try {
    return await load()
  } catch (err) {
    // 모듈이 정말 없을 때만 안내로 바꾼다. 로드된 모듈 안에서 난 오류는
    // 그대로 올려보내야 한다 — 삼키면 진짜 버그가 "의존성 없음"으로 둔갑한다.
    if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err
    throw new Error(DEPS_HINT)
  }
}

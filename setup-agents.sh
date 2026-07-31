#!/usr/bin/env bash
# 저장소 부트스트랩 런처. 실제 로직은 agent-installer에 있다.
#   ./setup-agents.sh [--skill-mode auto|link|copy] [--dry-run]
#   ./setup-agents.sh --tui    # 의존성 설치 후 대화형 화면 (--menu는 옛 이름)
set -Eeuo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/agent-installer"

command -v node >/dev/null 2>&1 || {
  # Node가 없으면 i18n 기계장치가 아예 돌지 못한다. 런처에 로케일 감지
  # 분기를 넣는 대신 이 한 문장만 병기한다.
  echo "Node.js 20 or later is required / Node.js 20 이상이 필요합니다: https://nodejs.org" >&2
  exit 1
}

if [[ "${1-}" == "--tui" || "${1-}" == "--menu" ]]; then
  npm install --prefix "$DIR" --silent
  exec node "$DIR/install.mjs" "${@:2}"
fi

exec node "$DIR/install.mjs" bootstrap "$@"

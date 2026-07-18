#!/usr/bin/env bash
# 저장소 부트스트랩 런처. 실제 로직은 agent-installer에 있다.
#   ./setup-agents.sh [--skill-mode auto|link|copy] [--dry-run]
#   ./setup-agents.sh --menu   # 의존성 설치 후 대화형 메뉴
set -Eeuo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/agent-installer"

command -v node >/dev/null 2>&1 || {
  echo "Node.js 20 이상이 필요합니다: https://nodejs.org" >&2
  exit 1
}

if [[ "${1-}" == "--menu" ]]; then
  npm install --prefix "$DIR" --silent
  exec node "$DIR/install.mjs" "${@:2}"
fi

exec node "$DIR/install.mjs" bootstrap "$@"

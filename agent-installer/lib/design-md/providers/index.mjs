// design.md 프로바이더 레지스트리 — 소스 확장 지점.
// 새 소스 추가 = 프로바이더 모듈 1개 작성 + 여기 등록.
import { awesomeDesignMd } from './awesome-design-md.mjs'

export const PROVIDERS = [awesomeDesignMd]

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id)
}

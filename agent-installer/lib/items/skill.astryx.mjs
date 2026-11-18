import { defineRecipe } from '../recipe.mjs'
import { npmApp, skillsAdd, withApp } from '../recipe-helpers.mjs'
// meta/astryx(MIT). Meta의 오픈소스 디자인 시스템. 저장소의 스킬은 plugins/astryx/skills/astryx
// 하나뿐이고(skills --list로 확인, 2026-11-18) 본문이 "astryx 명령이 이 컴퓨터에 있다"를 전제하는
// 안내 스텁이다 — 컴포넌트·템플릿·테마·문서는 전부 `astryx` CLI(@astryxdesign/cli, Node>=22.13)가
// 준다. 그래서 스킬만으로는 반쪽이고, PATH에 astryx가 없으면 npm i -g로 함께 깐다(상류 SKILL.md가
// 같은 명령을 안내한다). CLI의 postinstall은 안내 문구만 찍고 파일을 쓰지 않는다. 제거는 스킬만
// 지운다(withApp). 프로젝트 의존성(@astryxdesign/core 등)과 `astryx init`은 앱 코드를 고치므로 하지 않는다.
export default defineRecipe({
  id: 'skill.astryx', category: 'skill', label: 'Astryx', group: '__style',
  note: 'item.skill.astryx.note',
  verified: '2026-11-18',
  ...withApp(
    skillsAdd({ source: 'https://github.com/meta/astryx', skill: 'astryx' }),
    npmApp({ bin: 'astryx', pkg: '@astryxdesign/cli' }),
  ),
})

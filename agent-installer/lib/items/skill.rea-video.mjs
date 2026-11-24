import { defineRecipe } from '../recipe.mjs'
import { skillsAdd, uvToolApp, withApp } from '../recipe-helpers.mjs'
// JuneYaooo/rea-video(Apache-2.0). 영상을 샷 단위로 역분석해(실사·AI·3D·코드 렌더 등 판별, 자막·
// 음향·편집 분해) 다시 만드는 방법을 내는 스킬 하나(skills/rea-video, Markdown뿐, 2026-11-24 확인).
// 본문이 rea-video CLI를 구동하는 절차라 CLI가 전제다. PyPI에 없어 상류 setup.md대로 git에서
// [ocr]로 깐다. 3.12 이하에서는 [ocr]의 rapidocr-onnxruntime이 opencv-python을 함께 깔아 headless
// 판과 cv2를 다투므로, rapidocr 3(headless)을 쓰는 3.13으로 고정한다. ffmpeg는 깔지 않는다.
// 첫 decompose가 음원 분리 모델(약 216MB)을 GitHub에서 받고, --vlm은 Gemini 또는 OpenAI 호환 키가
// 있어야 영상 조각을 보낸다(선택). 상류 Claude 플러그인·install_skill.sh(~/.claude 등 전역 링크)는
// 쓰지 않는다. 제거는 스킬만 지운다(withApp).
export default defineRecipe({
  id: 'skill.rea-video', category: 'skill', label: 'rea-video', group: '__edit',
  note: 'item.skill.rea-video.note',
  verified: '2026-11-24',
  ...withApp(
    skillsAdd({ source: 'https://github.com/JuneYaooo/rea-video', skill: 'rea-video' }),
    uvToolApp({ bin: 'rea-video', pkg: 'rea-video[ocr] @ git+https://github.com/JuneYaooo/rea-video', python: '3.13' }),
  ),
})

---
name: 필라넷 팀즈인앱(웹·데스크톱 / 모바일) 디자인 시스템
colors:
  # Brand
  brand-primary: '#5B5FC7'
  brand-tint-1: '#9299F7'
  brand-tint-2: '#E8EBFA'
  brand-deep: '#444791'
  brand-deep-2: '#3D3E78'
  # Text / Icon
  foreground-default: '#242424'
  foreground-1: '#424242'
  foreground-2: '#616161'
  foreground-3: '#717171'
  foreground-disabled: '#C7C7C7'
  # Surface / Line
  white: '#FFFFFF'
  surface-2: '#F5F5F5'
  border-default: '#D1D1D1'
  border-2: '#E1E1E1'
  divider: '#EDEBE9'
  # Semantic
  red-foreground: '#C4314B'
  yellow-foreground: '#835B00'
  green-foreground: '#237B4B'
  green-surface: '#E7F2DA'
  yellow-surface: '#FBF6D9'
  red-surface: '#FCF4F6'
  good: '#107C10'
  warning: '#EAA300'
  attention: '#C50F1F'
  # Badge (component-scoped tokens)
  badge-tint-accent-bg: '#F2F4FC'
  badge-tint-accent-border: '#C5CBFA'
  badge-tint-accent-fg: '#4F52B2'
  badge-tint-good-bg: '#F2FBF2'
  badge-tint-good-border: '#9FD89F'
  badge-tint-good-fg: '#0E700E'
  badge-tint-warning-bg: '#FEFBF4'
  badge-tint-warning-border: '#F9E2AE'
  badge-tint-warning-fg: '#835B00'
  badge-tint-attention-bg: '#FDF3F4'
  badge-tint-attention-border: '#EEACB2'
  badge-tint-attention-fg: '#C50F1F'
  badge-tint-gray-bg: '#F0F0F0'
  badge-tint-gray-border: '#E0E0E0'
  badge-tint-gray-fg: '#616161'
  badge-tint-white-bg: '#FFFFFF'
  badge-tint-white-border: '#E0E0E0'
  badge-tint-white-fg: '#616161'
typography:
  title-1:
    fontFamily: Segoe UI
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '40px'
    usage: Greeting title
  title-2:
    fontFamily: Segoe UI
    fontSize: 28px
    fontWeight: '400'
    lineHeight: '36px'
    usage: Page title
  title-3:
    fontFamily: Segoe UI
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '32px'
    usage: Email header
  headline:
    fontFamily: Segoe UI
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '28px'
    usage: Page/pane header
  subheadline-1:
    fontFamily: Segoe UI
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '24px'
    usage: Subject title
  body-1:
    fontFamily: Segoe UI
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '20px'
    usage: Body/button
  caption:
    fontFamily: Segoe UI
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '16px'
    usage: Caption
rounded:
  input: 4px
  select: 3px
  checkbox: 3px
  badge-pill: 16px
  toggle: 100px
  sheet-top: 14px
  modal: 24px
  circular: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 28px
  xxxl: 32px
  section: 40px
shadows:
  shadow-2: rgba(0,0,0,0.14) 0px 0.3px 0.45px, rgba(0,0,0,0.12) 0px 1.6px 1.8px
  shadow-4: rgba(0,0,0,0.14) 0px 1.6px 3.6px, rgba(0,0,0,0.12) 0px 0.3px 0.9px
  shadow-8: rgba(0,0,0,0.12) 0px 0px 2px, rgba(0,0,0,0.14) 0px 4px 8px
  shadow-16: rgba(0,0,0,0.12) 0px 0px 1px, rgba(0,0,0,0.14) 0px 8px 8px
  shadow-32: rgba(0,0,0,0.12) 0px 0px 4px, rgba(0,0,0,0.14) 0px 14px 14px
  shadow-64: rgba(0,0,0,0.18) 0px 4.8px 7.2px, rgba(0,0,0,0.22) 0px 25.6px 28.8px
---

## Brand & Style

Microsoft가 Teams 3rd-party 앱/탭 개발자를 위해 배포하는 **Teams In-App(Fluent 기반) 디자인 가이드**입니다. 웹·데스크톱·iOS·Android 네 플랫폼에서 공통된 토큰(컬러·타이포·스페이싱·쉐도우)을 정의하고, 그 위에 각 플랫폼 네이티브 컴포넌트(Desktop Side panel·Toast·Contextual menu, iOS Segmented Control·Action Sheet·Home indicator 등)를 얹는 방식이 특징입니다.

핵심은 **하나의 브랜드 퍼플(`#5B5FC7`)**을 축으로 한 절제된 팔레트, 라이트/다크 테마를 함께 정의하는 시맨틱 컬러 레이어, 그리고 뱃지·토글·버튼 등 컴포넌트 단위로 세분화된 상태(Rest/Hover/Press/Focus/Disabled) 명세입니다. 문서 말미에는 이 토큰을 실제 서비스 프로젝트에 적용한 예시가 함께 제공되어, 로컬라이즈 시 무엇을 바꾸고 무엇을 유지해야 하는지 보여줍니다.

**핵심 브랜드 속성:**
- **Fluent Consistency:** Teams 앱 내에서 이질감 없이 녹아드는 것을 최우선 목표로 함.
- **Platform-native Feel:** 웹/데스크톱은 Segoe UI(한글 로컬라이즈 시 Malgun Gothic/Noto Sans KR)·Pivot·Contextual menu, iOS는 SF Pro/Segmented Control·Action Sheet, Android는 Roboto를 그대로 사용.
- **Stateful Components:** 모든 인터랙티브 요소(Input, Toggle, Radio, Checkbox, Select)가 Rest/Hover/Press/Focus/Disabled 상태를 전부 정의.

## Colors

### Brand
- **Brand Foreground/Background** (`#5B5FC7`) — 주요 액션·버튼·활성 탭·토글 On.
- **Brand Border 1** (`#9299F7`) — 브랜드 테두리.
- **Brand Background 1** (`#E8EBFA`) — 채팅 'Me' 말풍선.
- **Brand Background 2** (`#3D3E78`) — 미팅 라이브 헤더.
- **Brand Background 4** (`#444791`) — TFW(Teams for Work) 타이틀 바.

### Neutral (Text & Surface)
- **Default Foreground** (`#242424`) — 기본 텍스트/아이콘.
- **Default Foreground 1** (`#424242`) — 보조 텍스트/아이콘.
- **Default Foreground 2** (`#616161`) — 3차 텍스트/아이콘, placeholder.
- **Heading** (`#717171`) — 표 헤더 라벨(Style/Usage/Font size).
- **Default Foreground Disabled** (`#C7C7C7`) — 비활성 텍스트/아이콘.
- **Default Border** (`#D1D1D1`) — 기본 테두리.
- **Default Background** (`#FFFFFF`) — 카드·다이얼로그·메뉴·입력창 배경(회색 캔버스 위).
- **Default Background 2** (`#F5F5F5`) — 채팅 캔버스, 입력창 배경(흰 캔버스 위).
- **Divider** (`#EDEBE9`) — 타이포 표 등 구분선.

### Semantic
- **Red Foreground** (`#C4314B`) — 오류/중요/경고 텍스트·아이콘.
- **Yellow Foreground 4** (`#835B00`) — 경고·자리비움(away) 메시지.
- **Green Foreground** (`#237B4B`) — 성공/온라인 상태.
- **Green Background 2** (`#E7F2DA`) — 성공 배너 배경.
- **Yellow Background 1** (`#FBF6D9`) — 메시지 하이라이트 배경.
- **Red Background 1** (`#FCF4F6`) — 오류 배너 및 채팅 메시지 배경.

### Badge (컴포넌트 전용 토큰)
Filled(고대비)와 Tint(저채도) 두 축, 그리고 Default/Accent/Good/Warning/Attention 다섯 시맨틱으로 구성됩니다.
- **Filled:** Default `#242424`, Subtle `#EBEBEB`, Accent `#5B5FC7`, Good `#107C10`, Warning `#EAA300`, Attention `#C50F1F` (모두 배경색, 텍스트는 배경 대비에 따라 흰색 또는 `#242424`).
- **Tint:** Accent bg `#F2F4FC` / border `#C5CBFA` / fg `#4F52B2`, Good bg `#F2FBF2` / border `#9FD89F` / fg `#0E700E`, Warning bg `#FEFBF4` / border `#F9E2AE` / fg `#835B00`, Attention bg `#FDF3F4` / border `#EEACB2` / fg `#C50F1F`.

### Dark Theme

라이트 테마 대비 명도를 낮추고 텍스트/배경을 반전한 다크 팔레트입니다. 브랜드 색상은 톤을 유지하되 다크 배경 위 대비 확보를 위해 명도를 조정했습니다. 기존 라이트 테마 토큰명(frontmatter `colors`)에 대응시켜 표기합니다.

**Brand**

| Token | Light | Dark |
|---|---|---|
| brand-primary | `#5B5FC7` | `#9499F5` |
| brand-tint-1 | `#9299F7` | `#7F85F5` |
| brand-tint-2 | `#E8EBFA` | `#2F2F4A` |
| brand-deep | `#444791` | `#444791` (동일) |
| brand-deep-2 | `#3D3E78` | `#3D3E78` (동일) |

**Background**

| Token | Light | Dark |
|---|---|---|
| white(surface) | `#FFFFFF` | `#292929` |
| surface-2 | `#F5F5F5` | `#242424` |
| input-bg | `#FCFCFC` | `#242424` — surface-2와 별개 토큰으로 유지(입력 필드 전용 배경). |

**Text / Icon**

| Token | Light | Dark |
|---|---|---|
| foreground-default | `#242424` | `#FFFFFF` |
| foreground-1 | `#424242` | `#D6D6D6` |
| foreground-2 | `#616161` | `#ADADAD` |
| foreground-disabled | `#C7C7C7` | `#ADADAD` |

**Border**

| Token | Light | Dark |
|---|---|---|
| border-default | `#D1D1D1` | `#0F0F0F` |
| border-2 | `#E1E1E1` | `#0F0F0F` |
| divider | `#EDEBE9` | `#424242` |

**Badge / Semantic**

Badge(Filled/Tint 전체)와 Semantic(Red/Yellow/Green Foreground·Surface)은 다크 테마에서도 Light 테마 값을 그대로 사용합니다(별도 다크 색상 지정 없음).

## Typography

기본 척도는 **Segoe UI**(웹/데스크톱 기준)로 정의되며, Title 1(32/40) → Title 2(28/36) → Title 3(24/32) → Headline(20/28) → Subheadline 1(18/24) → Body 1(14/20) → Caption(12/16) 순의 7단 램프를 갖습니다. 이 크기·행간 램프는 플랫폼 공통이며, 플랫폼별로 다른 것은 서체(font-family)뿐입니다.

서체·크기·행간 램프는 테마와 무관하게 동일합니다. 다크 테마에서 바뀌는 것은 글자 색(`foreground-*` 토큰)뿐입니다.

플랫폼별 서체는 다음과 같습니다.
- **Desktop (Web/Windows 클라이언트):** 기본 서체는 Segoe UI이나, 한글 로컬라이즈 시 **Malgun Gothic** 또는 **Noto Sans KR**로 대체합니다. 위 사이즈·행간 램프는 그대로 유지합니다.
- **Android:** Roboto.
- **iOS:** SF Pro (Display: 타이틀류 / Text: 본문·버튼류). 예) iOS Title 1 = SF Pro Display Bold 26/31, iOS Subhead 1 = SF Pro Text Medium 17/20, iOS Button 1 = SF Pro Text Medium 15/20, iOS Caption 1 = SF Pro Text Regular 12/16.

## Layout & Spacing

스페이싱은 **4px 베이스**로 4 / 8 / 12 / 16 / 20 / 24 / 28 / 32 / 40px 스텝을 제공하며, "컨테이너 크기에 따라 아래 단위 중 하나로 요소 간 간격을 둘 것"을 원칙으로 합니다. 시스템 컴포넌트 카드는 40px(외부) / 48px(내부) 패딩을, 카드 내부 필드 간격은 32px를 기본값으로 사용합니다.

### Responsive Breakpoints — Desktop/Web

- **최소 너비:** 550px.
- **표준 범위:** 1024px–1278px.
- **최대 너비:** 1440px.
- **200% 줌 대응:** 200% 브라우저/OS 줌까지 텍스트가 잘리지 않고 자동 줄바꿈(word-wrap)되어야 하며, 가로 스크롤이 발생하지 않도록 설계합니다.

### Responsive Breakpoints — Mobile

모바일은 미디어 쿼리 없는 단일 유동(fluid) 레이아웃이며, 375px를 최소 지원 하한으로 합니다.

| 구간 | 너비 범위 | 비고 |
|---|---|---|
| Small phone | 375–428px | 최소 지원 하한 |
| Standard phone | 429–767px | 표준 대응 — 이 문서의 모바일 데모(280–375px 목업 폭)가 속하는 구간 |
| Tablet | 768px 이상 | 위 Desktop/Web 표(1024–1278px 표준, 1440px 최대)로 인계 |

**핵심 고정값(전 구간 공통, 폭 분기와 무관):** 헤더 높이 · 콘텐츠 좌우 패딩 20px · 좌측 Nav 드로어 · 중앙 모달 · 바텀시트 · Safe Area env

**설계 원칙:** 모바일은 브레이크포인트 기반 레이아웃 전환을 사용하지 않고 **375px 하한의 단일 유동 레이아웃**을 기본으로 하며, 768px 이상은 Desktop/Web 스펙으로 인계합니다. 인계가 보장되지 않는 환경에서는 주요 컨테이너에 `max-width: 600px; margin: 0 auto` 상한을 두어 폭이 무한정 늘어나는 것을 방지합니다.

## Elevation & Shadow

Fluent의 이중 레이어(핵심광 + 환경광) 섀도우 스케일을 **Shadow-2 / 4 / 8 / 16 / 32 / 64**의 6단계로 정의합니다. 값이 커질수록 리스트 아이템(2) → 카드(4) → 메뉴/드롭다운(8) → 팝오버(16) → 대형 서피스(32) → 모달/다이얼로그(64) 순으로 계층이 높아집니다. Shadow 값은 다크 테마에서도 Light와 동일하게 사용합니다(별도 다크 전용 알파/확산 반경 값 없음).

## Shapes

- **Input / Checkbox:** 3–4px 코너(각진 느낌 최소화).
- **Badge:** Circular(16px 라운드, 20px 정사각 박스 기준 완전한 원으로 렌더링) / Rounded(4px, 기본) / Square(0px, 각진) 3가지 셰이프를 사이즈(Medium/Large/Extra large)와 별개로 선택 가능.
- **Toggle:** 100px pill.
- **Task Module(Modal):** 24px 라운드(모바일 풀스크린 시트).
- **Bottom Sheet:** 상단 코너만 14px 라운드.
- **Button:** 버튼 규칙 다이어그램은 크기가 커질수록 코너 반경이 4 → 8 → 12px로 단계적으로 커지고, 아이콘 전용/원형 버튼은 완전한 Circular로 처리하도록 안내합니다.

## Components

### Buttons

- **Shared:** "Teams 버튼 형태를 부득이 변경해야 하는 경우, 일관된 경험 유지를 위해 사이징·스페이싱 가이드를 따를 것"을 명시합니다. 아래 4가지 크기 규칙과 Floating Button(FAB)은 전 플랫폼 공통 적용됩니다.

  | Size | Height | Min-width | Padding | Font-size | Radius |
  |---|---|---|---|---|---|
  | Small | 28px | 58px | 5px 8px | 14px | 4px |
  | Medium | 40px | 70px | 10px 14px | 12px | 8px |
  | Large | 40px | 100px | 10px 14px | 14px | 8px |
  | Full-width | 52px | 100% width | 14px 20px | 14px | 8px |

  **Floating Button (FAB):** 60×60px 원형(pill), 배경 `#5B5FC7`, 중앙 20×20 흰색 아이콘(단일 액션을 나타내는 심볼, 예: 연필 아이콘).

- **Desktop:** Dialog/페이지 내 버튼 그룹은 보통 우측 정렬(Primary가 가장 우측)로 배치합니다. Hover/Press/Focus 상태색은 컴포넌트별 정의를 따릅니다. FAB은 데스크톱에서는 잘 사용되지 않고 툴바/커맨드바 버튼으로 대체됩니다.

- **Mobile:** Primary(`#5B5FC7` 배경, 흰 텍스트) / Secondary(`#9299F7` 1px 테두리, `#5B5FC7` 텍스트) 버튼이 풀와이드로 세로로 쌓여 배치됩니다. 버튼 사이 간격 8px로 정리합니다.

### Badges

플랫폼 공통.

- **Shapes:** Circular(radius 16px) / Rounded(radius 4px) / Square(radius 0) — 20×20px 스와치 기준.
- **Configurations:** Icon + text / Text + icon / Text only / Icon only.
- 위 Filled·Tint 컬러 세트(Colors 참조)와 조합해 하나의 뱃지 컴포넌트로 상태·라벨을 표현합니다.

### Inputs

플랫폼 공통. `#F5F5F5` 배경 카드 안에 개별 필드(흰 배경, 4px 라운드)를 배치하고 Rest / Focus / Focus-텍스트입력 / Keyboard Focus 4가지 상태를 보여줍니다. Placeholder는 `#616161`, 입력된 텍스트는 `#242424`, 포커스 시 하단에 브랜드 퍼플(`#5B5FC7`) 2px 인디케이터가 나타나며, 우측에 성공/오류 아이콘과 닫기(IconButton)가 겹쳐 노출될 수 있습니다.

**Dark Theme:** 캔버스는 `surface-2`(다크 `#242424`), 필드 배경은 `white`(다크 `#292929`), 텍스트는 `foreground-*`, 포커스 인디케이터는 `brand-primary`(다크 `#9499F5`) 다크 토큰을 그대로 적용합니다.

### Select (Dropdown)

플랫폼 공통. 필드 라벨(12px, `#484644`) + 작은 인풋필드(32px 높이, 3px 라운드, 값 텍스트는 항상 `#242424`) 구조이며, 우측에 셰브론(chevron-down) 아이콘이 항상 표시됩니다. Rest(1px 연회색 테두리) / Press(하단 2px 브랜드 언더라인 포커스 인디케이터) / Error(빨간 1px 테두리 + 하단 "Error" 헬프텍스트, `#C4314B`) 3상태를 정의하며, 펼침 메뉴는 흰 배경에 `shadow-8`, 항목 hover 시 `#F5F5F5` 배경.

**Dark Theme:** 필드 배경은 `white`(다크 `#292929`), 테두리는 `border-default`(다크 `#0F0F0F`), 값 텍스트는 `foreground-default`(다크 `#FFFFFF`) 토큰을 그대로 적용합니다.

### Toggle

플랫폼 공통. 40×20px 필(pill) 스위치. On 상태는 브랜드 퍼플 계열(Rest `#5B5FC7` → Hover `#464775` → Press `#33344A`), Off 상태는 아웃라인만(Rest/Hover/Press `#605E5C`~`#484644`), Disabled는 `#EDEBE9` 아웃라인/배경. Focus 시 검정 2px 외곽 링이 추가됩니다.

**Dark Theme (Figma 확인, Teams UI Kit):** Off — Rest `#B3B0AD` → Hover `#C8C6C4` → Focus `#B3B0AD` + 흰색 2px 외곽 링 → Disabled `#424242`. On — Rest `#4F52B2` → Hover `#9EA2FF` → Pressed `#7479DC` → Focus 배경 `#5B5FC7` + 링 `#7F85F5` → Disabled 배경 `#3B3A3A`. // TODO: 값 확인 — Off/Pressed(Down) 다크 값은 Figma에 이미지 에셋으로만 존재해 정확한 HEX 미확인.

### Radio & Checkbox

플랫폼 공통. 16px 원형(Radio)/사각형(Checkbox, 3px 라운드) 컨트롤. Unselected는 `#616161` 테두리(Disabled `#C7C7C7`), Selected는 브랜드 퍼플로 채워지고 체크마크(Teams Assets 아이콘 폰트)가 흰색으로 표시됩니다. Disabled selected는 `#C8C6C4`로 톤다운됩니다.

**Dark Theme:** Unselected 테두리는 `foreground-2` 다크(`#ADADAD`), Selected 배경은 `brand-primary` 다크(`#9499F5`) 토큰을 그대로 적용합니다.

### Tabs — Segmented Control & Pivot

- **Shared:** 탭은 현재 활성 위치를 명확히 나타내는 인디케이터(보더 또는 텍스트 강조)를 갖습니다.
- **Desktop (Pivot):** Active tab은 브랜드 퍼플 텍스트 + 하단 2px 보더, Unselected tab은 `#616161`(hover 시 `#242424`)텍스트, 별도 보더 없음.
- **Mobile (iOS Segmented Control, 3 Segments):** 상단 네비게이션 바로 아래 44px 높이, 활성 세그먼트는 하단 2px 보더 + Semibold 라벨, 나머지는 Regular.
- **Dark Theme:** Active tab 텍스트/보더는 `brand-primary` 다크(`#9499F5`), Unselected 텍스트는 `foreground-2` 다크(`#ADADAD`) 토큰을 그대로 적용합니다.

### Depth — Breadcrumb & Overflow Menu

플랫폼 공통. L1(조직/팀명) → Overflow(⋯, "More Horizontal") → L3(현재 위치) 순으로 배치되는 반응형 브레드크럼입니다. 경로가 길어지면 중간 구간을 Overflow 메뉴로 접어 한 줄에 간결하게 유지하도록 안내합니다. 세그먼트 사이는 12px 세로 디바이더(`#D1D1D1`)로 구분합니다.

### Task Module (Modal)

- **Shared:** 24px 라운드(`rounded.modal`), `shadow-64`, 콘텐츠 하단에 Primary/Secondary 버튼 페어 배치.
- **Desktop:** 화면 중앙 고정 Dialog로 열립니다. 뒷배경은 스크림으로 덮이며, 헤더에 타이틀 + 닫기(X) 버튼이 위치합니다. 폭은 반응형 최대 너비(1440px) 내에서 콘텐츠에 맞게 가변적으로 사용합니다.
- **Mobile:** 풀스크린 바텀시트 형태로 열리며, 상단은 다크 상태바(`#141414`) + 검정 네비게이션 헤더(제목 2줄: 타이틀 15px Semibold + 서브타이틀 12px), 콘텐츠 영역은 `shadow-8` 카드, 하단 고정 영역에 Primary/Secondary 버튼 페어가 배치되고 최하단에 Home Indicator를 남깁니다.

### Bottom Sheet (Action Sheet) — Mobile

배경을 40% 블랙 스크림으로 덮고, 화면 하단에서 올라오는 흰 시트(상단 코너만 14px 라운드, `shadow-8`)에 아이콘+라벨 리스트 셀(52px 높이)을 쌓습니다. 각 셀은 좌측 24px 아이콘 + 17px 라벨 구성이며 최하단에 Home Indicator를 남깁니다. (예시 항목: Settings, Copy link, Open in browser, Rename, Delete)

**Desktop 대응:** 데스크톱에서는 이 패턴 대신 우클릭 **Contextual Menu**(Components > Contextual Menu 참조)를 사용합니다.

### Menu List — Mobile

세로 스택형 리스트 메뉴 패턴(참고 스크린샷 기준)으로, 위 Bottom Sheet 리스트 셀과 동일한 아이콘+텍스트 구조를 화면 전체 리스트에 확장 적용한 형태입니다.

**Desktop 대응:** 데스크톱에서는 화면 전체 리스트 내비게이션 대신 **Left Nav**(사이드바) 또는 **Contextual Menu**(Components 참조)가 동일한 역할을 대체합니다.

### Side Panel — Desktop

미팅/탭 화면 우측에 여닫을 수 있는 패널입니다. 패널이 열리면 메인 스테이지가 축소 재배치됩니다.
- 패널 미표시 시 스테이지 기본 크기 994×678px, 패널 표시 시 918×540px로 축소됩니다(Meeting Stage 기준 참고값).
- 채팅/참가자 목록/앱 등을 패널 콘텐츠로 사용할 수 있습니다.
- 위 수치는 참고용 예시이며, 실제 Side Panel/Stage 사이즈는 프로젝트·화면 구성에 따라 달라질 수 있습니다.

### Toast — Desktop

화면 우측 등에 노출되는 알림 배너입니다. 배경 `#5B5FC7` 고정, 라운드 3px, 패딩 16px. 타이틀(Semibold 14px/20px, 흰색) + 서브텍스트(Regular 12px/16px, 흰색) 2줄 구성이며 우측에 작은 아이콘이 붙습니다. 다크 테마에서도 Light와 동일합니다(별도 다크 값 없음).

### Scrollbar — Desktop

Fluent 스크롤바는 오버레이형으로, 콘텐츠 폭을 줄이지 않고 우측 가장자리 위에 살짝 겹쳐 떠 있습니다(네이티브 스크롤바는 항상 자체 트랙 공간을 차지하므로, 데모 구현은 네이티브 스크롤바를 숨기고 JS로 위치를 계산하는 커스텀 오버레이 썸으로 구현했습니다). Thumb 색상은 `#9E9E9E`, 폭 `6px`로 라이트/다크 테마 동일(플립 없음), 기본 상태에서는 옅게 표시되다가 Hover 시 강조됩니다. 컨테이너 코너는 2px 라운드입니다. 스크롤 영역 배경은 다크 테마에서 `#2D2D2D`(일반 `surface-2` 다크 값과는 별도 지정)를 사용하며, 하단에는 포커스 상태를 나타내는 2px 브랜드 보더(Light `#5B5FC7` / Dark `#7F85F5`, `brand-primary` 다크 토큰과는 별도 지정)가 표시됩니다.

### Contextual Menu (우클릭) — Desktop

마우스 우클릭 또는 키보드(Menu 키/Shift+F10)로 호출되는 컨텍스트 메뉴입니다(Figma 확인). 항목은 아이콘+라벨 리스트로 구성되며, 관련 명령끼리는 구분선(divider)으로 그룹핑합니다. 하위 메뉴(submenu)를 가질 수 있습니다. 배경은 Light 흰색 / Dark `#2D2C2C`(페이지 다크 배경 `#1F1F1F`과는 다른 메뉴 전용 색), 라운드 3px.
- 대상 요소 우클릭 시 커서 위치 기준으로 열립니다.
- 메뉴 폭은 콘텐츠 길이에 따라 자동 조정되며 고정폭이 아닙니다.
- Bottom Sheet(Mobile)와 동일한 역할을 데스크톱에서 대체합니다.

### Tooltip

아이콘 전용 버튼 등 라벨이 없는 요소는 Hover 후 짧은 지연 뒤 텍스트 툴팁을 노출합니다(Figma 확인, Teams UI Kit). 배경 `#424242`(라이트/다크 동일), 라운드 3px, 패딩 `12px/5px`(좌우/상하), 텍스트 12px Regular 흰색, `shadow-4`와 유사한 그림자로 표시합니다.

OS 스타일 툴팁(`OSTooltip`, Figma 확인)은 흰 배경 + `#E1E1E1` 1px 테두리, 그림자 `0px 2px 2px rgba(0,0,0,0.1)`, 라운드 없음(각진 모서리), 텍스트 12px Regular `#252423`로 테마와 무관하게 항상 흰색을 유지합니다. 브랜드 툴팁과 달리 말풍선 화살표(arrow)가 없습니다.

## Page

### Empty State
데이터가 없을 때의 형태입니다. 중앙에 회색 톤 일러스트 아이콘(약 129px)과 하단에 안내 문구(14px Regular, `#424242`, 중앙정렬 — 예: "일치하는 결과가 없습니다.")를 세로로 배치합니다.

### Completed State
사용자 액션(제출 등)이 완료됐을 때의 형태입니다. 체크 아이콘 → 타이틀(20px Bold, `#242424`) + 서브텍스트(14px Regular, `#616161`) → 버튼 그룹(전체 40px 간격) 순으로 세로 중앙 정렬합니다. 버튼 그룹은 Outlined 버튼(들) 아래에 Primary 버튼(52px, full-width)을 마지막에 배치하는 구성을 기본으로 합니다.

## Applied Example — 프로젝트 적용 참고

위 MS 기본 토큰을 실제 서비스에 이식할 때 무엇을 바꾸고 무엇을 유지했는지 보여주는 참고 화면입니다.

- **폰트 로컬라이즈:** Android → Noto Sans, iOS → Apple SDGothic Neo로 교체(한글 가독성 확보). Title/Headline/Body 등 사이즈·행간 램프는 MS 기준(32/40, 28/36, 24/32, 20/28, 18/24, 14/20, 12/16) 그대로 유지.
- **아이콘 매칭:** 자체 기능(작성/즐겨찾기/첨부파일/캘린더/객관식/일정투표/평점/서술식/채팅/통화/연락처 등 약 30종)을 의미가 동일한 MS Teams 제공 아이콘으로 1:1 매칭.
- **Spacing 적용:** Medium/Default/Small 간격 라벨을 실제 리스트·인풋 요소 높이(예: 44px)에 매핑해 터치 타깃 기준을 시각화.
- **Badge 적용:** 기본(인디고)/Gray/Green/Yellow/White 5가지 컬러의 Text-only 필 배지를 정의(예: "익명" 라벨).
- **Button 적용:** Small/Large/Medium/Full-width 4단 크기 규칙 + Secondary Button 스타일을 실제 화면에 적용.

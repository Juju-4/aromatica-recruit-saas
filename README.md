# Recruit SaaS — 아로마티카 HR 분석 플랫폼

채용 · 보상 · 조직 데이터를 업로드하면 KPI와 차트로 분석해 주는 웹 앱입니다.

**접속 주소:** https://aromatica-recruit-saas.vercel.app

---

## 처음 사용하는 분을 위한 안내

### 1. 로그인
- 접속하면 로그인 화면이 나옵니다.
- 처음이면 **[첫 사용자 등록]** 탭에서 이메일·비밀번호로 가입합니다.
- 관리자(전체 권한)는 `juyeongim7@gmail.com` 계정으로 자동 지정됩니다.
- 다른 사람을 추가하려면 로그인 후 **설정 → 사용자·권한 → 사용자 초대**를 사용하세요.

### 2. 권한(역할) 3단계
| 역할 | 할 수 있는 일 |
|---|---|
| **관리자** | 모든 데이터 + 사용자·권한·조직 관리 |
| **편집자** | 데이터 업로드 · 원본 수정 · 삭제 |
| **뷰어** | 분석 결과와 원본 데이터 열람만 |

### 3. 데이터 넣는 방법 (모든 분석 화면 공통)
1. 분석 화면(예: *적정인원 진단*)을 엽니다.
2. **데이터 관리** 영역에서 필요한 항목의 **[양식 다운로드]** 를 눌러 엑셀 양식을 받습니다.
3. 양식의 예시 행을 지우고 실제 데이터를 채웁니다. (첫 줄 헤더 이름은 그대로 두세요.)
4. **[파일 업로드]** → 미리보기 확인 → **[저장]**.
5. 저장하면 아래 **분석 결과**(행 수 · 합계 · 부서별 차트 · 미리보기 표)가 바로 나타납니다.

### 4. 올린 데이터 관리
- **원본 보기 · 수정** : 표에서 셀을 클릭해 바로 고칩니다. 저장 버튼 없이 자동 저장되고 분석에 즉시 반영됩니다. 행 추가·삭제도 가능합니다.
- **⭐(별표)** : 한 항목에 여러 번 업로드했을 때 분석에 쓸 “대표” 데이터셋을 고릅니다.
- **🗑(휴지통)** : 데이터셋 전체를 삭제합니다.
- **데이터 입력** 화면 = 12개 항목을 한곳에서 관리하는 허브 + 업로드 이력. 관리자는 여기서 **전체 초기화**(모든 업로드 데이터 삭제)도 할 수 있습니다.

### 5. 화면 구성
- **종합 현황** — 채용·보상·조직 핵심 지표 요약
- **채용관리 / 보상·협상 / 정착·리텐션 / HR 분석** — 19개 분석 화면
- **설정 → 조직 관리** — 부서·부서장·승인정책
- **설정 → 사용자·권한** — 사용자 목록·역할 변경·초대

> 예측(정착 예측 · 이탈 예측 · 적정인원 · 임금 시뮬레이터)은 현재 **실데이터 집계**만 제공합니다.
> 데이터가 충분히 쌓이면 예측 모델 점수가 활성화됩니다.

---

## 개발자용 메모

| 항목 | 값 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) · React 19 · TypeScript |
| UI | Tailwind v4 · shadcn/ui (base-nova) · Recharts |
| 백엔드 | Supabase (Postgres · Auth · Storage · Realtime · RLS) |
| 배포 | Vercel (GitHub `main` 푸시 시 자동 배포) |
| 엑셀 | SheetJS(`xlsx`) — 양식 생성 + 업로드 파싱 (동적 로드) |

### 로컬 실행
```bash
npm install
# .env.local 에 Supabase 값 필요:
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
npm run dev        # http://localhost:3000
```
> 이 PC는 메모리가 빠듯해 `npm run dev` 와 `npm run build` 를 동시에 돌리지 마세요.
> 빌드는 `NODE_OPTIONS=--max-old-space-size=3072 npm run build`.

### 데이터 모델 (범용 데이터셋 구조)
- `data_categories` — 12개 카테고리 정의 (양식 컬럼은 `src/lib/data-catalog.ts` 가 단일 소스)
- `datasets` — 업로드 단위 (카테고리·이름·기간·행수·활성여부·원본파일경로)
- `dataset_rows` — 행 1개당 1레코드, 값은 `values` JSONB
- `profiles` — 사용자·역할(admin/editor/viewer) · `handle_new_user` 트리거가 가입 시 자동 생성
- `pending_invites` — 초대 이메일별 역할 (가입 시 자동 적용)
- `departments` — 부서

RLS: 뷰어=읽기, 편집자=datasets/dataset_rows CRUD, 관리자=사용자·조직·카테고리.
Realtime: `datasets` · `dataset_rows` · `departments` (DELETE 필터 매칭 위해 `REPLICA IDENTITY FULL`).

### 주요 파일
- `src/lib/nav.ts` — 사이드바 19+2 화면 정의 (단일 소스)
- `src/lib/data-catalog.ts` — 카테고리별 엑셀 양식 컬럼 정의
- `src/lib/datasets.ts` · `src/lib/analytics.ts` · `src/lib/xlsx.ts` — 데이터 레이어
- `src/components/data/` — DatasetManager · RawDataGrid · DataSummary 등 공통 컴포넌트
- `src/app/(app)/[slug]/page.tsx` — 분석 화면 (dataentry·org·rbac 는 전용 라우트)
- `src/lib/supabase/` · `src/middleware.ts` — 인증

> 이전 정적 목업은 `legacy-mockup.html` 로 보존되어 있습니다.

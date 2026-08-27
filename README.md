# Recruit SaaS — HR Analytics Platform

`recruit_saas_mockup_final_10.html` 목업을 동작하는 정적 사이트로 구성한 결과물입니다.

**배포 주소: https://aromatica-recruit-saas.vercel.app/**

- `index.html` — 배포용(차트/폰트 CDN 참조)
- `index.local.html` + `vendor/` — 오프라인/로컬 프리뷰용(의존성 로컬 포함)
- GitHub: https://github.com/Juju-4/aromatica-recruit-saas (Vercel git 연동)
- **재배포: `main` 브랜치에 `git push` 하면 자동 배포됨** (별도 명령 불필요)

## 구조
- `index.html` — 단일 페이지 앱 (사이드바 탭 전환 방식, 19개 화면)
- `vendor/` — 외부 CDN 의존성을 로컬로 포함 (오프라인 동작)
  - `chart.umd.min.js` (Chart.js 4.4.4)
  - `chartjs-plugin-datalabels.min.js` (2.2.0)
  - `pretendard.min.css`

## 실행
```bash
npx -y serve -l 4173 .
```
브라우저에서 http://localhost:4173 접속.

## 원본 목업 대비 변경점
- 깨진 `@font-face` 임베드 블록 제거 → Pretendard/Inter + 시스템 폰트 폴백
- Chart.js / datalabels CDN 참조를 `vendor/` 로컬 파일로 교체
- 누락된 `</body></html>` 닫는 태그 보정

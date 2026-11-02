# hanmazzi
한국리서치 맛집 지도

## 구조
- `public/` — 사이트 화면 (`index.html`)
- `src/worker.js` — `/api/*` 를 처리하는 Worker. 데이터는 **Cloudflare D1** 에 저장 (테이블은 첫 요청 때 자동 생성)
- `wrangler.jsonc` — Worker 설정 (D1 연결 포함)

> 예전에는 Supabase 를 썼는데, Supabase 무료 플랜은 7일 동안 안 쓰면 프로젝트가 일시정지돼서 D1 으로 옮겼습니다.
> D1 무료 플랜은 일시정지가 없습니다.

## 처음 한 번 설정 (Cloudflare 대시보드)
1. Cloudflare 대시보드 → **Storage & Databases → D1 SQL Database → Create** → 이름 `hanmazzi-db`
2. 만든 데이터베이스의 **Database ID** 를 복사해서 `wrangler.jsonc` 의 `database_id` 에 붙여 넣고 커밋
3. 배포되면 끝 (main 에 푸시하면 자동 배포)

## 로컬에서 실행
```
npx wrangler dev
```

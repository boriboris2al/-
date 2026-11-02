# hanmazzi
한국리서치 맛집 지도

## 구조
- `public/` — 사이트 화면 (`index.html`), 데이터 옮기기 페이지 (`migrate.html`)
- `src/worker.js` — `/api/*` 를 처리하는 Worker. 데이터는 **Cloudflare D1** 에 저장 (테이블은 첫 요청 때 자동 생성)
- `wrangler.jsonc` — Worker 설정 (D1 연결 포함)

> 예전에는 Supabase 를 썼는데, Supabase 무료 플랜은 7일 동안 안 쓰면 프로젝트가 일시정지돼서 D1 으로 옮겼습니다.
> D1 무료 플랜은 일시정지가 없습니다.

## 처음 한 번 설정 (Cloudflare 대시보드)
1. Cloudflare 대시보드 → **Storage & Databases → D1 SQL Database → Create** → 이름 `hanmazzi-db`
2. 만든 데이터베이스의 **Database ID** 를 복사해서 `wrangler.jsonc` 의 `database_id` 에 붙여 넣고 커밋
3. 배포되면 끝 (main 에 푸시하면 자동 배포)

## 예전 Supabase 데이터 옮기기 (한 번만)
1. Supabase 대시보드에서 일시정지된 프로젝트를 **Restore** (무료 프로젝트는 일시정지 후 90일까지 복원 가능)
2. 배포된 사이트의 `/migrate.html` 열기 → 버튼 클릭
3. 새 DB 가 비어 있을 때만 동작하므로, 옮긴 뒤에는 다시 눌러도 덮어쓰지 않습니다.

## 로컬에서 실행
```
npx wrangler dev
```

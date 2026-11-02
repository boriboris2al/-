// 한맛지 API — Cloudflare D1 에 맛집 데이터를 저장합니다.
// /api/* 요청만 이 코드가 처리하고, 나머지(index.html 등)는 public/ 폴더의 정적 파일이 나갑니다.
//
//   GET    /api/restaurants              목록 (비밀번호는 내보내지 않음)
//   POST   /api/restaurants              등록   { nick, pw, name, ... }
//   POST   /api/restaurants/:id/verify   비밀번호 확인 { pw }
//   PUT    /api/restaurants/:id          수정   { pw, name, ... }
//   DELETE /api/restaurants/:id          삭제   { pw }

const SCHEMA = `CREATE TABLE IF NOT EXISTS restaurants (
  id         TEXT PRIMARY KEY,
  nick       TEXT NOT NULL,
  pw_hash    TEXT NOT NULL,
  name       TEXT NOT NULL,
  address    TEXT,
  maplink    TEXT,
  menu       TEXT,
  note       TEXT,
  star       INTEGER,
  lat        REAL,
  lng        REAL,
  created_at INTEGER,
  category   TEXT
)`;

const EDITABLE = ['name', 'address', 'maplink', 'menu', 'note', 'star', 'lat', 'lng', 'category'];
const PUBLIC_COLS = 'id, nick, name, address, maplink, menu, note, star, lat, lng, created_at, category';

let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.prepare(SCHEMA).run();
  schemaReady = true;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const fail = (message, status = 400) => json({ error: message }, status);

const cleanPw = (pw) => String(pw ?? '').replace(/[^0-9]/g, '').slice(0, 4);
const isPw = (pw) => /^[0-9]{4}$/.test(String(pw ?? ''));
const str = (v, max = 2000) => (v == null ? null : String(v).slice(0, max));
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

function fields(body) {
  return {
    name: str(body.name, 200),
    address: str(body.address, 500),
    maplink: str(body.maplink, 1000),
    menu: str(body.menu, 500),
    note: str(body.note, 2000),
    star: Math.max(0, Math.min(5, Math.round(num(body.star) ?? 0))),
    lat: num(body.lat),
    lng: num(body.lng),
    category: str(body.category, 50) || '기타',
  };
}

async function checkPw(db, id, pw) {
  const row = await db.prepare('SELECT pw_hash FROM restaurants WHERE id = ?').bind(id).first();
  if (!row) return 'notfound';
  return String(row.pw_hash) === cleanPw(pw) ? 'ok' : 'wrong';
}

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

async function handleApi(request, env, path) {
  const db = env.DB;
  if (!db) return fail('D1 데이터베이스(DB)가 연결되지 않았어요', 500);
  await ensureSchema(db);
  const method = request.method;

  if (path === '/api/restaurants') {
    if (method === 'GET') {
      const { results } = await db
        .prepare(`SELECT ${PUBLIC_COLS} FROM restaurants ORDER BY created_at DESC`)
        .all();
      return json(results);
    }
    if (method === 'POST') {
      const body = await readBody(request);
      const nick = str(body.nick, 50);
      if (!nick) return fail('닉네임을 입력해주세요');
      if (!isPw(body.pw)) return fail('비밀번호는 숫자 4자리로만 입력해주세요');
      const f = fields(body);
      if (!f.name) return fail('가게 이름을 입력해주세요');
      const row = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        nick,
        created_at: Date.now(),
        ...f,
      };
      await db
        .prepare(
          `INSERT INTO restaurants (id, nick, pw_hash, name, address, maplink, menu, note, star, lat, lng, created_at, category)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(row.id, row.nick, cleanPw(body.pw), row.name, row.address, row.maplink, row.menu,
              row.note, row.star, row.lat, row.lng, row.created_at, row.category)
        .run();
      return json(row, 201);
    }
    return fail('지원하지 않는 요청이에요', 405);
  }

  const verify = path.match(/^\/api\/restaurants\/([^/]+)\/verify$/);
  if (verify && method === 'POST') {
    const body = await readBody(request);
    const r = await checkPw(db, decodeURIComponent(verify[1]), body.pw);
    if (r === 'notfound') return fail('대상 맛집을 찾을 수 없어요', 404);
    if (r === 'wrong') return fail('비밀번호가 틀렸어요', 403);
    return json({ ok: true });
  }

  const item = path.match(/^\/api\/restaurants\/([^/]+)$/);
  if (item && (method === 'PUT' || method === 'DELETE')) {
    const id = decodeURIComponent(item[1]);
    const body = await readBody(request);
    const r = await checkPw(db, id, body.pw);
    if (r === 'notfound') return fail('대상 맛집을 찾을 수 없어요', 404);
    if (r === 'wrong') return fail('비밀번호가 틀렸어요', 403);
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM restaurants WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
    const f = fields(body);
    if (!f.name) return fail('가게 이름을 입력해주세요');
    await db
      .prepare(`UPDATE restaurants SET ${EDITABLE.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
      .bind(...EDITABLE.map((c) => f[c]), id)
      .run();
    const updated = await db.prepare(`SELECT ${PUBLIC_COLS} FROM restaurants WHERE id = ?`).bind(id).first();
    return json(updated);
  }

  return fail('없는 주소예요', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url.pathname);
      } catch (e) {
        return fail('서버 오류: ' + (e && e.message ? e.message : e), 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

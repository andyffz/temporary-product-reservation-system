// 共享：货品定义、初始库存、CORS 工具、管理员鉴权

export const PRODUCTS = [
  { id: 1, name: '海笋',            unit: '包', price: 10,    priceLabel: '10 元 3 包',   step: 3, total: 18, date: '2026.8.2',    dateType: 'expired', note: '已过期' },
  { id: 2, name: '光中杏仁',        unit: '包', price: 12,    priceLabel: '12 元 / 包',   step: 1, total: 5,  date: '2026.12.16',  dateType: 'ok' },
  { id: 3, name: '芥末花生',        unit: '罐', price: 5,     priceLabel: '5 元 / 罐',    step: 1, total: 5,  date: '2026.1 生产', dateType: 'ok' },
  { id: 4, name: '微辣热干面',      unit: '包', price: 3,     priceLabel: '3 元 / 包',    step: 1, total: 1,  date: '2025.12 生产', dateType: 'ok' },
  { id: 5, name: '榛子仁巧克力豆',  unit: '盒', price: 10,    priceLabel: '10 元 / 盒',   step: 1, total: 2,  date: '2027.2',      dateType: 'ok' },
  { id: 6, name: '道家火锅料',      unit: '包', price: 29.9,  priceLabel: '29.9 元 3 包', step: 3, total: 87, date: '2026.11.2',   dateType: 'ok' },
  { id: 7, name: '斋九福素鱼香肉丝', unit: '袋', price: 14.9,  priceLabel: '14.9 元 / 袋（买二赠一）', step: 1, total: 36, date: '2026.10.16',  dateType: 'ok', deal: '买二赠一' }
];

export function initialState() {
  const stock = {};
  PRODUCTS.forEach(p => { stock[p.id] = p.total; });
  return { stock, orders: [] };
}

// ========== 管理员账号 & Session 鉴权 ==========
// 管理员密码：部署时通过环境变量 ADMIN_PASSWORD 覆盖，本地开发默认 admin123
export const ADMIN_USERNAME = 'admin';
export function getAdminPassword(env) {
  return (env && env.ADMIN_PASSWORD && String(env.ADMIN_PASSWORD).trim()) || 'admin123';
}

// Session TTL：7 天（毫秒）
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
function sessionKey(token) { return 'session_' + token; }

// 生成 32 字符安全随机 token
export function generateToken() {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 创建 Session 写入 KV
export async function createSession(env, username) {
  const kv = env.T1_KV;
  if (!kv) throw new Error('KV 未绑定');
  const token = generateToken();
  const session = { username, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS };
  await kv.put(sessionKey(token), JSON.stringify(session), { expirationTtl: Math.floor(SESSION_TTL_MS / 1000) });
  return { token, session };
}

// 解析 Authorization: Bearer <token> / Cookie 中的 token
function extractToken(request) {
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.match(/^Bearer\s+([A-Za-z0-9._~+-]+)$/i);
  if (bearer) return bearer[1];
  // 备用：Cookie
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
  return m ? m[1] : null;
}

/**
 * 鉴权中间件：管理 API 开头调用此函数
 * @returns {{ok:true, username:string, token:string}} 校验通过
 * @returns {Response} 校验失败直接返回 401 响应（调用方要 instanceof 判断）
 */
export async function requireAuth(request, env) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: '服务器未绑定 KV' }, 500);
  const token = extractToken(request);
  if (!token) return json({ error: '未登录，请先登录管理员账号' }, 401);
  let raw;
  try { raw = await kv.get(sessionKey(token)); } catch (e) { return json({ error: '读取 Session 失败' }, 500); }
  if (!raw) return json({ error: '登录已过期，请重新登录' }, 401);
  let session;
  try { session = JSON.parse(raw); } catch (e) { return json({ error: 'Session 损坏' }, 401); }
  if (!session || !session.expiresAt || session.expiresAt < Date.now()) {
    try { await kv.delete(sessionKey(token)); } catch (_) {}
    return json({ error: '登录已过期，请重新登录' }, 401);
  }
  return { ok: true, username: session.username || ADMIN_USERNAME, token };
}

// 销毁 Session
export async function destroySession(env, token) {
  const kv = env.T1_KV;
  if (!kv || !token) return;
  try { await kv.delete(sessionKey(token)); } catch (_) {}
}

// 买二赠一：赠品数 = floor(qty / 2)，库存扣 qty + 赠品，付款只算 qty
export function calcGift(product, qty) {
  if (product.deal === '买二赠一' && qty >= 2) return Math.floor(qty / 2);
  return 0;
}
export function calcTake(product, qty) {
  return qty + calcGift(product, qty);
}

export function calcPrice(product, qty) {
  if (product.step > 1) return (qty / product.step) * product.price;
  // 买二赠一：赠品免费，只付买的数量
  return qty * product.price;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

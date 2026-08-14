// 共享库：商品库、团单（Campaign）数据模型、迁移逻辑、算价引擎、鉴权、CORS

// ========== 基础商品库 ==========

export const DEFAULT_PRODUCTS = [
  { id: 1, name: '海笋',            unit: '包', price: 10,    priceLabel: '10 元 3 包',   step: 3, total: 18, date: '2026.8.2',    dateType: 'expired', note: '已过期' },
  { id: 2, name: '光中杏仁',        unit: '包', price: 12,    priceLabel: '12 元 / 包',   step: 1, total: 5,  date: '2026.12.16',  dateType: 'ok' },
  { id: 3, name: '芥末花生',        unit: '罐', price: 5,     priceLabel: '5 元 / 罐',    step: 1, total: 5,  date: '2026.1 生产', dateType: 'ok' },
  { id: 4, name: '微辣热干面',      unit: '包', price: 3,     priceLabel: '3 元 / 包',    step: 1, total: 1,  date: '2025.12 生产', dateType: 'ok' },
  { id: 5, name: '榛子仁巧克力豆',  unit: '盒', price: 10,    priceLabel: '10 元 / 盒',   step: 1, total: 2,  date: '2027.2',      dateType: 'ok' },
  { id: 6, name: '道家火锅料',      unit: '包', price: 29.9,  priceLabel: '29.9 元 3 包', step: 3, total: 87, date: '2026.11.2',   dateType: 'ok' },
  { id: 7, name: '斋九福素鱼香肉丝', unit: '袋', price: 14.9,  priceLabel: '14.9 元 / 袋（买二赠一）', step: 1, total: 36, date: '2026.10.16',  dateType: 'ok', deal: '买二赠一' }
];

const PRODUCTS_KV_KEY = 'products';

export async function getProducts(env) {
  const kv = env.T1_KV;
  if (!kv) return DEFAULT_PRODUCTS.map(p => ({ ...p }));
  try {
    const raw = await kv.get(PRODUCTS_KV_KEY);
    if (raw) {
      const products = JSON.parse(raw);
      if (Array.isArray(products)) return products;
    }
    await kv.put(PRODUCTS_KV_KEY, JSON.stringify(DEFAULT_PRODUCTS));
    return DEFAULT_PRODUCTS.map(p => ({ ...p }));
  } catch (e) {
    return DEFAULT_PRODUCTS.map(p => ({ ...p }));
  }
}

export async function saveProducts(env, products) {
  const kv = env.T1_KV;
  if (!kv) throw new Error('KV 未绑定');
  await kv.put(PRODUCTS_KV_KEY, JSON.stringify(products));
}

export function nextProductId(products) {
  if (!products || products.length === 0) return 1;
  return Math.max(...products.map(p => Number(p.id) || 0)) + 1;
}

// ========== 团单（Campaign）数据模型 ==========
//
// KV Key 结构：
//   campaigns                    → Campaign[]            团单列表
//   campaign:<id>:products       → CampaignProduct[]     团单内商品（含优惠规则）
//   campaign:<id>:stock          → { productId: qty }    团单库存
//   campaign:<id>:orders         → Order[]               团单订单
//
// CampaignProduct:
//   { productId, name, unit, price, priceLabel, step, total, date, dateType, note, promotionRules }
//
// promotionRules:
//   { type: "none" }
//   { type: "buyGet", buy: N, get: M }       买N赠M
//   { type: "tiered", tiers: [{ minQty, price }] }  阶梯价

const CAMPAIGNS_KV_KEY = 'campaigns';

function cpKey(id) { return `campaign:${id}:products`; }
function csKey(id) { return `campaign:${id}:stock`; }
function coKey(id) { return `campaign:${id}:orders`; }

export async function getCampaigns(env) {
  const kv = env.T1_KV;
  if (!kv) return [];
  try {
    const raw = await kv.get(CAMPAIGNS_KV_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {}
  return [];
}

export async function saveCampaigns(env, campaigns) {
  const kv = env.T1_KV;
  if (!kv) throw new Error('KV 未绑定');
  await kv.put(CAMPAIGNS_KV_KEY, JSON.stringify(campaigns));
}

export function nextCampaignId(campaigns) {
  if (!campaigns || campaigns.length === 0) return 1;
  return Math.max(...campaigns.map(c => Number(c.id) || 0)) + 1;
}

export async function getCampaign(env, id) {
  const campaigns = await getCampaigns(env);
  return campaigns.find(c => c.id === Number(id)) || null;
}

export async function getCampaignProducts(env, campaignId) {
  const kv = env.T1_KV;
  if (!kv) return [];
  try {
    const raw = await kv.get(cpKey(campaignId));
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export async function saveCampaignProducts(env, campaignId, products) {
  const kv = env.T1_KV;
  if (!kv) throw new Error('KV 未绑定');
  await kv.put(cpKey(campaignId), JSON.stringify(products));
}

export async function getCampaignStock(env, campaignId) {
  const kv = env.T1_KV;
  if (!kv) return {};
  try {
    const raw = await kv.get(csKey(campaignId));
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

export async function saveCampaignStock(env, campaignId, stock) {
  const kv = env.T1_KV;
  if (!kv) throw new Error('KV 未绑定');
  await kv.put(csKey(campaignId), JSON.stringify(stock));
}

export async function getCampaignOrders(env, campaignId) {
  const kv = env.T1_KV;
  if (!kv) return [];
  try {
    const raw = await kv.get(coKey(campaignId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {}
  return [];
}

export async function saveCampaignOrders(env, campaignId, orders) {
  const kv = env.T1_KV;
  if (!kv) throw new Error('KV 未绑定');
  await kv.put(coKey(campaignId), JSON.stringify(orders));
}

// ========== 迁移：将旧 state 数据迁移为 campaign_id=1 ==========

const CN_NUM = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
function cnToInt(s) { return CN_NUM[s] !== undefined ? CN_NUM[s] : (Number(s) || 0); }

function convertDealToRules(deal) {
  if (!deal) return { type: 'none' };
  const m = deal.match(/买([0-9一二三四五六七八九十]+)赠([0-9一二三四五六七八九十]+)/);
  if (m) return { type: 'buyGet', buy: cnToInt(m[1]), get: cnToInt(m[2]) };
  return { type: 'none' };
}

export async function migrateToCampaigns(env) {
  const kv = env.T1_KV;
  if (!kv) return null;

  const existing = await getCampaigns(env);
  if (existing.length > 0) return existing[0];

  // 读取旧数据
  const products = await getProducts(env);
  let oldState = null;
  try {
    const raw = await kv.get('state');
    if (raw) oldState = JSON.parse(raw);
  } catch (e) {}

  const now = formatTime(new Date());
  const campaign = {
    id: 1,
    name: '第一期云仓调回特惠',
    startTime: oldState?.createdAt || now,
    endTime: '',
    status: 'active',
    description: '历史数据自动迁移',
    createdAt: now
  };

  // 转换商品 → 团单商品（含 promotionRules）
  const campaignProducts = products.map(p => ({
    productId: p.id,
    name: p.name,
    unit: p.unit || '个',
    price: p.price,
    priceLabel: p.priceLabel || '',
    step: p.step || 1,
    total: p.total || 0,
    date: p.date || '',
    dateType: p.dateType || 'ok',
    note: p.note || '',
    promotionRules: convertDealToRules(p.deal)
  }));

  // 迁移库存
  const stock = {};
  if (oldState && oldState.stock) {
    for (const [k, v] of Object.entries(oldState.stock)) {
      stock[k] = v;
    }
  } else {
    products.forEach(p => { stock[p.id] = p.total; });
  }
  // 确保所有商品都有库存记录
  campaignProducts.forEach(p => {
    if (stock[p.productId] == null) stock[p.productId] = p.total;
  });

  // 迁移订单
  const orders = (oldState && Array.isArray(oldState.orders)) ? oldState.orders.map(o => ({
    ...o,
    campaignId: 1,
    items: (o.items || []).map(it => ({
      ...it,
      productId: it.id,
      promotionApplied: it.gift > 0 ? '买赠' : ''
    }))
  })) : [];

  // 写入 KV
  await saveCampaigns(env, [campaign]);
  await saveCampaignProducts(env, 1, campaignProducts);
  await saveCampaignStock(env, 1, stock);
  await saveCampaignOrders(env, 1, orders);

  return campaign;
}

// ========== 算价引擎 ==========

/**
 * 计算赠品数量
 * @param {Object} rules - promotionRules
 * @param {number} qty
 * @returns {number} 赠品数量
 */
export function calcGift(rules, qty) {
  if (!rules || rules.type !== 'buyGet') return 0;
  if (qty < rules.buy) return 0;
  return Math.floor(qty / rules.buy) * (rules.get || 1);
}

/**
 * 计算实际取货量（含赠品）
 */
export function calcTake(product, rules, qty) {
  return qty + calcGift(rules, qty);
}

/**
 * 计算付款金额
 * - 阶梯价：按满足的最高阶梯单价计算
 * - 步进价：step>1 时 price 为每步总价
 * - 买赠：赠品免费
 */
export function calcPrice(product, rules, qty) {
  let unitPrice = product.price;

  if (rules && rules.type === 'tiered' && Array.isArray(rules.tiers) && rules.tiers.length > 0) {
    const sorted = [...rules.tiers].sort((a, b) => b.minQty - a.minQty);
    const tier = sorted.find(t => qty >= t.minQty);
    if (tier) unitPrice = tier.price;
  }

  if (product.step > 1) {
    return (qty / product.step) * unitPrice;
  }

  return qty * unitPrice;
}

/**
 * 生成优惠规则的人类可读描述
 */
export function describePromotion(rules) {
  if (!rules || rules.type === 'none') return '';
  if (rules.type === 'buyGet') return `买${rules.buy}赠${rules.get}`;
  if (rules.type === 'tiered' && Array.isArray(rules.tiers)) {
    return [...rules.tiers]
      .sort((a, b) => a.minQty - b.minQty)
      .map(t => `满${t.minQty}件${t.price}元`)
      .join('，');
  }
  return '';
}

/**
 * 检查是否触发优惠（用于前端实时提示）
 */
export function checkPromotionTriggered(rules, qty) {
  if (!rules || rules.type === 'none') return null;
  if (rules.type === 'buyGet' && qty >= rules.buy) {
    const gift = calcGift(rules, qty);
    return { type: 'buyGet', message: `已达买${rules.buy}赠${rules.get}标准，赠${gift}件` };
  }
  if (rules.type === 'tiered' && Array.isArray(rules.tiers)) {
    const sorted = [...rules.tiers].sort((a, b) => b.minQty - a.minQty);
    const tier = sorted.find(t => qty >= t.minQty);
    if (tier) return { type: 'tiered', message: `已达阶梯价：${tier.minQty}件以上${tier.price}元/件` };
  }
  return null;
}

// ========== 时间工具 ==========

export function formatTime(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ========== 取货码 ==========

export function generatePickupCode(existingOrders = []) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existingCodes = new Set((existingOrders || []).map(o => o.pickupCode).filter(Boolean));
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    const bytes = new Uint8Array(6);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length];
    if (!existingCodes.has(code)) return code;
  }
  return ('XX' + Date.now().toString(36).toUpperCase()).slice(-6);
}

// ========== 鉴权 ==========

export const ADMIN_USERNAME = 'admin';
export function getAdminPassword(env) {
  return (env && env.ADMIN_PASSWORD && String(env.ADMIN_PASSWORD).trim()) || 'admin123';
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
function sessionKey(token) { return 'session_' + token; }

export function generateToken() {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(env, username) {
  const kv = env.T1_KV;
  if (!kv) throw new Error('KV 未绑定');
  const token = generateToken();
  const session = { username, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS };
  await kv.put(sessionKey(token), JSON.stringify(session), { expirationTtl: Math.floor(SESSION_TTL_MS / 1000) });
  return { token, session };
}

function extractToken(request) {
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.match(/^Bearer\s+([A-Za-z0-9._~+-]+)$/i);
  if (bearer) return bearer[1];
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
  return m ? m[1] : null;
}

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

export async function destroySession(env, token) {
  const kv = env.T1_KV;
  if (!kv || !token) return;
  try { await kv.delete(sessionKey(token)); } catch (_) {}
}

// ========== 兼容旧 API 的 initialState ==========

export function initialState(products) {
  const stock = {};
  (products || []).forEach(p => { stock[p.id] = p.total; });
  return { stock, orders: [] };
}

// ========== HTTP 工具 ==========

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

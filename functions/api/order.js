import { PRODUCTS, calcGift, calcPrice, calcTake, handleOptions, initialState, json } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost({ request, env }) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: '请求格式错误' }, 400);
  }

  const name = (body.name || '').toString().trim();
  const contact = (body.contact || '').toString().trim();
  const note = (body.note || '').toString().trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!name) return json({ error: '请填写姓名' }, 400);
  if (items.length === 0) return json({ error: '购物车为空' }, 400);

  // 读取当前状态
  let state;
  try {
    const raw = await kv.get('state');
    state = raw ? JSON.parse(raw) : initialState();
  } catch (e) {
    state = initialState();
  }
  if (!state.stock) state.stock = {};
  if (!Array.isArray(state.orders)) state.orders = [];

  // 校验库存（含赠品）
  for (const it of items) {
    const p = PRODUCTS.find(x => x.id === Number(it.id));
    if (!p) return json({ error: `货品不存在: ${it.id}` }, 400);
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty <= 0) return json({ error: `数量无效: ${p.name}` }, 400);
    if (qty % p.step !== 0) return json({ error: `「${p.name}」需按 ${p.step} 的倍数选择` }, 400);
    const remain = state.stock[p.id] ?? p.total;
    const take = calcTake(p, qty);
    if (take > remain) {
      const gift = calcGift(p, qty);
      return json({ error: `「${p.name}」剩余 ${remain}，选 ${qty} 需 ${take}（含赠品 ${gift}）` }, 409);
    }
  }

  // 扣减库存 + 生成订单
  const orderItems = items.map(it => {
    const p = PRODUCTS.find(x => x.id === Number(it.id));
    const qty = Number(it.qty);
    const take = calcTake(p, qty);
    state.stock[p.id] = (state.stock[p.id] ?? p.total) - take;
    const gift = calcGift(p, qty);
    return { id: p.id, name: p.name, qty, unit: p.unit, subtotal: calcPrice(p, qty), gift };
  });

  const total = orderItems.reduce((s, x) => s + x.subtotal, 0);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const order = {
    name, contact, note,
    items: orderItems,
    total,
    time: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  };
  state.orders.push(order);

  try {
    await kv.put('state', JSON.stringify(state));
  } catch (e) {
    return json({ error: '保存失败，请重试' }, 500);
  }

  return json({ ok: true, order, state });
}

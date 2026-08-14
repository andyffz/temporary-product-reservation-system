import { handleOptions, initialState, json, requireAuth } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: '请求格式错误' }, 400);
  }

  // 支持两种模式：按索引 idx 或按取货码 pickupCode
  const hasPickupCode = body.pickupCode && typeof body.pickupCode === 'string';
  const pickedUp = body.pickedUp === true || body.pickedUp === 'true' || body.pickedUp === 1;

  let state;
  try {
    const raw = await kv.get('state');
    state = raw ? JSON.parse(raw) : initialState();
  } catch (e) {
    state = initialState();
  }
  if (!Array.isArray(state.orders)) state.orders = [];

  let idx;

  if (hasPickupCode) {
    // 按取货码查找
    const code = body.pickupCode.trim().toUpperCase();
    idx = state.orders.findIndex(o => (o.pickupCode || '').toUpperCase() === code);
    if (idx === -1) return json({ error: '取货码无效' }, 404);
  } else {
    // 按索引查找
    idx = Number(body.idx);
    if (!Number.isInteger(idx) || idx < 0) return json({ error: '订单索引无效' }, 400);
    if (idx >= state.orders.length) return json({ error: '订单不存在' }, 404);
  }

  state.orders[idx].pickedUp = pickedUp;
  if (pickedUp && !state.orders[idx].pickedUpAt) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    state.orders[idx].pickedUpAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  } else if (!pickedUp) {
    delete state.orders[idx].pickedUpAt;
  }

  try {
    await kv.put('state', JSON.stringify(state));
  } catch (e) {
    return json({ error: '保存失败' }, 500);
  }

  return json({ ok: true, order: state.orders[idx] });
}

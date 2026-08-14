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

  const idx = Number(body.idx);
  const pickedUp = body.pickedUp === true || body.pickedUp === 'true' || body.pickedUp === 1;

  if (!Number.isInteger(idx) || idx < 0) return json({ error: '订单索引无效' }, 400);

  let state;
  try {
    const raw = await kv.get('state');
    state = raw ? JSON.parse(raw) : initialState();
  } catch (e) {
    state = initialState();
  }
  if (!Array.isArray(state.orders)) state.orders = [];

  if (idx >= state.orders.length) return json({ error: '订单不存在' }, 404);

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

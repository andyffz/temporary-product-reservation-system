import { PRODUCTS, handleOptions, initialState, json } from './_lib.js';

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

  const id = Number(body.id);
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return json({ error: '货品不存在' }, 400);

  // 两种模式：直接设置新值(set) 或 相对增减(delta)
  const setVal = body.set != null ? Number(body.set) : null;
  const delta = body.delta != null ? Number(body.delta) : null;

  if (setVal == null && delta == null) return json({ error: '缺少 set 或 delta 参数' }, 400);
  if (setVal != null && (!Number.isInteger(setVal) || setVal < 0)) return json({ error: '库存值无效' }, 400);
  if (delta != null && !Number.isInteger(delta)) return json({ error: '增减值无效' }, 400);

  let state;
  try {
    const raw = await kv.get('state');
    state = raw ? JSON.parse(raw) : initialState();
  } catch (e) {
    state = initialState();
  }
  if (!state.stock) state.stock = {};

  const current = state.stock[p.id] ?? p.total;
  if (setVal != null) {
    state.stock[p.id] = setVal;
  } else {
    state.stock[p.id] = Math.max(current + delta, 0);
  }

  try {
    await kv.put('state', JSON.stringify(state));
  } catch (e) {
    return json({ error: '保存失败' }, 500);
  }

  return json({ ok: true, stock: state.stock });
}

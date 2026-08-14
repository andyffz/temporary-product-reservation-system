import { handleOptions, initialState, json, requireAuth } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// 只清空订单，保留当前库存
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  let state;
  try {
    const raw = await kv.get('state');
    state = raw ? JSON.parse(raw) : initialState();
  } catch (e) {
    state = initialState();
  }
  if (!state.stock) state.stock = initialState().stock;
  state.orders = [];

  try {
    await kv.put('state', JSON.stringify(state));
  } catch (e) {
    return json({ error: '清空订单失败' }, 500);
  }
  return json({ ok: true, state });
}

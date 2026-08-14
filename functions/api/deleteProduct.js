import { getProducts, saveProducts, handleOptions, json, requireAuth } from './_lib.js';

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

  const id = Number(body.id);
  if (!id) return json({ error: '商品 ID 无效' }, 400);

  const products = await getProducts(env);
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return json({ error: '商品不存在' }, 400);

  const removed = products.splice(idx, 1)[0];
  await saveProducts(env, products);

  // 同时从库存状态中移除该商品
  let state;
  try {
    const raw = await kv.get('state');
    state = raw ? JSON.parse(raw) : { stock: {}, orders: [] };
  } catch (e) {
    state = { stock: {}, orders: [] };
  }
  if (!state.stock) state.stock = {};
  delete state.stock[id];
  await kv.put('state', JSON.stringify(state));

  return json({ ok: true, removed, products, stock: state.stock });
}

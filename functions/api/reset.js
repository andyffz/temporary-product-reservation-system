import { getProducts, initialState, json, handleOptions, requireAuth } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  // 读取当前动态商品列表，基于它重置库存
  const products = await getProducts(env);
  const state = initialState(products);

  try {
    await kv.put('state', JSON.stringify(state));
  } catch (e) {
    return json({ error: '重置失败' }, 500);
  }

  return json({ ok: true, state });
}

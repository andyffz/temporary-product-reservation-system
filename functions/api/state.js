import { getProducts, initialState, json, handleOptions } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet({ env }) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  // 读取动态商品列表
  const products = await getProducts(env);

  let state;
  try {
    const raw = await kv.get('state');
    state = raw ? JSON.parse(raw) : null;
  } catch (e) {
    return json({ error: '读取失败' }, 500);
  }

  if (!state) {
    state = initialState(products);
    await kv.put('state', JSON.stringify(state));
  }
  if (!state.stock) state.stock = {};
  if (!Array.isArray(state.orders)) state.orders = [];

  // 确保所有当前商品都有库存记录（新添加的商品自动补全）
  products.forEach(p => {
    if (state.stock[p.id] == null) state.stock[p.id] = p.total;
  });

  return json({ ...state, products });
}

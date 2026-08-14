import { getProducts, saveProducts, handleOptions, json, requireAuth } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

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

  return json({ ok: true, removed, products });
}

import { getProducts, handleOptions, json, requireAuth } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// GET /api/products → 基础商品库列表（需鉴权）
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const products = await getProducts(env);
  return json({ products });
}

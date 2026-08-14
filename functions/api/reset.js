import {
  getCampaignProducts, saveCampaignStock,
  saveCampaignOrders,
  handleOptions, json, requireAuth
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// POST /api/reset → 重置指定团单的库存和订单（需鉴权）
// body: { campaignId }
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  let body;
  try { body = await request.json(); } catch (e) { body = {}; }

  const campaignId = Number(body.campaignId) || 1;

  const products = await getCampaignProducts(env, campaignId);
  const stock = {};
  products.forEach(p => { stock[p.productId] = p.total; });

  await saveCampaignStock(env, campaignId, stock);
  await saveCampaignOrders(env, campaignId, []);

  return json({ ok: true, stock });
}

import {
  getCampaignProducts, getCampaignStock, saveCampaignStock,
  getCampaignOrders, saveCampaignOrders,
  handleOptions, json, requireAuth
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// POST /api/clearOrders → 清空指定团单的订单，保留库存（需鉴权）
// body: { campaignId }
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  let body;
  try { body = await request.json(); } catch (e) { body = {}; }

  const campaignId = Number(body.campaignId) || 1;

  await saveCampaignOrders(env, campaignId, []);

  return json({ ok: true });
}

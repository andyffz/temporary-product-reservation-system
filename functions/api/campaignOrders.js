import {
  getCampaignOrders,
  handleOptions, json, requireAuth
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// GET /api/campaignOrders?campaignId=X → 团单订单列表（需鉴权）
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  const url = new URL(request.url);
  const campaignId = Number(url.searchParams.get('campaignId'));
  if (!campaignId) return json({ error: '缺少 campaignId' }, 400);

  const orders = await getCampaignOrders(env, campaignId);

  return json({ orders });
}

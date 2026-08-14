import {
  getCampaignOrders, saveCampaignOrders,
  formatTime, handleOptions, json, requireAuth
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// POST /api/updateOrder → 更新订单取货状态（需鉴权）
// body: { campaignId, pickupCode?, idx?, pickedUp }
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

  const campaignId = Number(body.campaignId) || 1;
  const hasPickupCode = body.pickupCode && typeof body.pickupCode === 'string';
  const pickedUp = body.pickedUp === true || body.pickedUp === 'true' || body.pickedUp === 1;

  const orders = await getCampaignOrders(env, campaignId);

  let idx;
  if (hasPickupCode) {
    const code = body.pickupCode.trim().toUpperCase();
    idx = orders.findIndex(o => (o.pickupCode || '').toUpperCase() === code);
    if (idx === -1) return json({ error: '取货码无效' }, 404);
  } else {
    idx = Number(body.idx);
    if (!Number.isInteger(idx) || idx < 0) return json({ error: '订单索引无效' }, 400);
    if (idx >= orders.length) return json({ error: '订单不存在' }, 404);
  }

  orders[idx].pickedUp = pickedUp;
  if (pickedUp && !orders[idx].pickedUpAt) {
    orders[idx].pickedUpAt = formatTime(new Date());
  } else if (!pickedUp) {
    delete orders[idx].pickedUpAt;
  }

  await saveCampaignOrders(env, campaignId, orders);

  return json({ ok: true, order: orders[idx] });
}

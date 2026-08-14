import {
  getCampaignOrders, saveCampaignOrders,
  formatTime, handleOptions, json, requireAuth
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// POST /api/batchUpdate → 批量操作订单（需鉴权）
// body: { campaignId, action: 'pickup'|'cancelPickup'|'delete', indices: [] }
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
  const action = body.action;
  const indices = Array.isArray(body.indices) ? body.indices.map(Number) : [];

  if (!action || !['pickup', 'cancelPickup', 'delete'].includes(action)) {
    return json({ error: '无效的操作类型' }, 400);
  }
  if (indices.length === 0) return json({ error: '未选择订单' }, 400);

  const orders = await getCampaignOrders(env, campaignId);
  const ts = formatTime(new Date());
  let affected = 0;

  const sortedIndices = [...new Set(indices)]
    .filter(i => Number.isInteger(i) && i >= 0 && i < orders.length)
    .sort((a, b) => b - a);

  if (action === 'delete') {
    for (const idx of sortedIndices) {
      orders.splice(idx, 1);
      affected++;
    }
  } else if (action === 'pickup') {
    for (const idx of sortedIndices) {
      if (!orders[idx].pickedUp) {
        orders[idx].pickedUp = true;
        if (!orders[idx].pickedUpAt) orders[idx].pickedUpAt = ts;
        affected++;
      }
    }
  } else if (action === 'cancelPickup') {
    for (const idx of sortedIndices) {
      if (orders[idx].pickedUp) {
        orders[idx].pickedUp = false;
        delete orders[idx].pickedUpAt;
        affected++;
      }
    }
  }

  await saveCampaignOrders(env, campaignId, orders);

  return json({ ok: true, orders, affected });
}

import {
  getCampaignStock, saveCampaignStock,
  getCampaignProducts,
  handleOptions, json, requireAuth
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// POST /api/updateStock → 调整团单商品库存（需鉴权）
// body: { campaignId, id, set?, delta? }
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
  const id = Number(body.id);

  const campaignProducts = await getCampaignProducts(env, campaignId);
  const p = campaignProducts.find(x => x.productId === id);
  if (!p) return json({ error: '货品不存在' }, 400);

  const setVal = body.set != null ? Number(body.set) : null;
  const delta = body.delta != null ? Number(body.delta) : null;

  if (setVal == null && delta == null) return json({ error: '缺少 set 或 delta 参数' }, 400);
  if (setVal != null && (!Number.isInteger(setVal) || setVal < 0)) return json({ error: '库存值无效' }, 400);
  if (delta != null && !Number.isInteger(delta)) return json({ error: '增减值无效' }, 400);

  const stock = await getCampaignStock(env, campaignId);
  const current = stock[id] ?? p.total;

  if (setVal != null) {
    stock[id] = setVal;
  } else {
    stock[id] = Math.max(current + delta, 0);
  }

  await saveCampaignStock(env, campaignId, stock);

  return json({ ok: true, stock });
}

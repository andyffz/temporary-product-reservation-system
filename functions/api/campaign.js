import {
  getCampaigns, saveCampaigns, getCampaign,
  getCampaignProducts, saveCampaignProducts,
  getCampaignStock, saveCampaignStock,
  getCampaignOrders, saveCampaignOrders,
  describePromotion,
  handleOptions, json, requireAuth
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// GET /api/campaign?id=X → 团单详情（含商品+库存）
export async function onRequestGet({ request, env }) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) return json({ error: '缺少团单 ID' }, 400);

  const campaign = await getCampaign(env, id);
  if (!campaign) return json({ error: '团单不存在' }, 404);

  const products = await getCampaignProducts(env, id);
  const stock = await getCampaignStock(env, id);

  // 确保所有商品都有库存记录
  let stockChanged = false;
  products.forEach(p => {
    if (stock[p.productId] == null) {
      stock[p.productId] = p.total;
      stockChanged = true;
    }
  });
  if (stockChanged) await saveCampaignStock(env, id, stock);

  // 附加优惠描述和当前库存
  const productsWithStock = products.map(p => ({
    ...p,
    id: p.productId,
    remain: stock[p.productId] ?? p.total,
    promotionDesc: describePromotion(p.promotionRules)
  }));

  return json({
    campaign,
    products: productsWithStock,
    stock
  });
}

// PUT /api/campaign?id=X → 更新团单（需鉴权）
export async function onRequestPut({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) return json({ error: '缺少团单 ID' }, 400);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: '请求格式错误' }, 400);
  }

  const campaigns = await getCampaigns(env);
  const idx = campaigns.findIndex(c => c.id === id);
  if (idx === -1) return json({ error: '团单不存在' }, 404);

  if (body.name) campaigns[idx].name = body.name.toString().trim();
  if (body.endTime !== undefined) campaigns[idx].endTime = body.endTime.toString().trim();
  if (body.status) campaigns[idx].status = body.status;
  if (body.description !== undefined) campaigns[idx].description = body.description.toString().trim();

  await saveCampaigns(env, campaigns);

  return json({ ok: true, campaign: campaigns[idx] });
}

// DELETE /api/campaign?id=X → 删除团单（需鉴权）
export async function onRequestDelete({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!id) return json({ error: '缺少团单 ID' }, 400);

  const campaigns = await getCampaigns(env);
  const idx = campaigns.findIndex(c => c.id === id);
  if (idx === -1) return json({ error: '团单不存在' }, 404);

  const removed = campaigns.splice(idx, 1)[0];
  await saveCampaigns(env, campaigns);

  // 清理团单数据
  try {
    await kv.delete(`campaign:${id}:products`);
    await kv.delete(`campaign:${id}:stock`);
    await kv.delete(`campaign:${id}:orders`);
  } catch (e) {}

  return json({ ok: true, removed });
}

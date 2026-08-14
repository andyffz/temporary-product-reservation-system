import {
  getCampaignProducts, saveCampaignProducts,
  getCampaignStock, saveCampaignStock,
  getProducts,
  describePromotion,
  handleOptions, json, requireAuth
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// GET /api/campaignProducts?campaignId=X → 团单商品列表（公开）
export async function onRequestGet({ request, env }) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  const url = new URL(request.url);
  const campaignId = Number(url.searchParams.get('campaignId'));
  if (!campaignId) return json({ error: '缺少 campaignId' }, 400);

  const products = await getCampaignProducts(env, campaignId);
  const stock = await getCampaignStock(env, campaignId);

  const result = products.map(p => ({
    ...p,
    id: p.productId,
    remain: stock[p.productId] ?? p.total,
    promotionDesc: describePromotion(p.promotionRules)
  }));

  return json({ products: result, stock });
}

// POST /api/campaignProducts → 从商品库选品加入团单（需鉴权）
// body: { campaignId, productIds: [1,2,3] }
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

  const campaignId = Number(body.campaignId);
  if (!campaignId) return json({ error: '缺少 campaignId' }, 400);

  const productIds = Array.isArray(body.productIds) ? body.productIds.map(Number) : [];
  if (productIds.length === 0) return json({ error: '未选择商品' }, 400);

  const baseProducts = await getProducts(env);
  const campaignProducts = await getCampaignProducts(env, campaignId);
  const stock = await getCampaignStock(env, campaignId);

  const existingIds = new Set(campaignProducts.map(p => p.productId));
  const added = [];

  for (const pid of productIds) {
    if (existingIds.has(pid)) continue;
    const bp = baseProducts.find(p => p.id === pid);
    if (!bp) continue;

    const cp = {
      productId: bp.id,
      name: bp.name,
      unit: bp.unit || '个',
      price: bp.price,
      priceLabel: bp.priceLabel || '',
      step: bp.step || 1,
      total: bp.total || 0,
      date: bp.date || '',
      dateType: bp.dateType || 'ok',
      note: bp.note || '',
      promotionRules: { type: 'none' }
    };
    campaignProducts.push(cp);
    stock[bp.id] = bp.total;
    added.push(cp);
  }

  await saveCampaignProducts(env, campaignId, campaignProducts);
  await saveCampaignStock(env, campaignId, stock);

  return json({ ok: true, added, products: campaignProducts, stock });
}

// PUT /api/campaignProducts → 更新团单商品（优惠规则/价格/库存等）（需鉴权）
// body: { campaignId, productId, name?, price?, priceLabel?, step?, total?, date?, dateType?, note?, promotionRules? }
export async function onRequestPut({ request, env }) {
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

  const campaignId = Number(body.campaignId);
  const productId = Number(body.productId);
  if (!campaignId || !productId) return json({ error: '缺少 campaignId 或 productId' }, 400);

  const campaignProducts = await getCampaignProducts(env, campaignId);
  const idx = campaignProducts.findIndex(p => p.productId === productId);
  if (idx === -1) return json({ error: '商品不在该团单中' }, 404);

  const p = campaignProducts[idx];

  if (body.name !== undefined) p.name = body.name.toString().trim();
  if (body.price !== undefined) p.price = Number(body.price);
  if (body.priceLabel !== undefined) p.priceLabel = body.priceLabel.toString().trim();
  if (body.step !== undefined) p.step = Number(body.step) || 1;
  if (body.total !== undefined) {
    const oldTotal = p.total;
    p.total = Number(body.total);
    // 同步库存：如果 total 变化，调整剩余库存
    const stock = await getCampaignStock(env, campaignId);
    const currentRemain = stock[productId] ?? oldTotal;
    const diff = p.total - oldTotal;
    stock[productId] = Math.max(currentRemain + diff, 0);
    await saveCampaignStock(env, campaignId, stock);
  }
  if (body.date !== undefined) p.date = body.date.toString().trim();
  if (body.dateType !== undefined) p.dateType = body.dateType;
  if (body.note !== undefined) p.note = body.note.toString().trim();
  if (body.promotionRules !== undefined) {
    p.promotionRules = body.promotionRules;
  }

  campaignProducts[idx] = p;
  await saveCampaignProducts(env, campaignId, campaignProducts);

  return json({ ok: true, product: p, promotionDesc: describePromotion(p.promotionRules) });
}

// DELETE /api/campaignProducts → 从团单移除商品（需鉴权）
// body: { campaignId, productId }
export async function onRequestDelete({ request, env }) {
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

  const campaignId = Number(body.campaignId);
  const productId = Number(body.productId);
  if (!campaignId || !productId) return json({ error: '缺少 campaignId 或 productId' }, 400);

  const campaignProducts = await getCampaignProducts(env, campaignId);
  const idx = campaignProducts.findIndex(p => p.productId === productId);
  if (idx === -1) return json({ error: '商品不在该团单中' }, 404);

  const removed = campaignProducts.splice(idx, 1)[0];
  await saveCampaignProducts(env, campaignId, campaignProducts);

  // 清理库存
  const stock = await getCampaignStock(env, campaignId);
  delete stock[productId];
  await saveCampaignStock(env, campaignId, stock);

  return json({ ok: true, removed, products: campaignProducts });
}

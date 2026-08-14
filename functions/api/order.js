import {
  getCampaignProducts, getCampaignStock, saveCampaignStock,
  getCampaignOrders, saveCampaignOrders,
  calcGift, calcPrice, calcTake, generatePickupCode,
  describePromotion, formatTime,
  migrateToCampaigns,
  handleOptions, json
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// POST /api/order → 提交预订订单（支持 campaignId）
// body: { campaignId, name, contact, note, items: [{ id, qty }] }
export async function onRequestPost({ request, env }) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: '请求格式错误' }, 400);
  }

  const name = (body.name || '').toString().trim();
  const contact = (body.contact || '').toString().trim();
  const note = (body.note || '').toString().trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!name) return json({ error: '请填写姓名' }, 400);
  if (items.length === 0) return json({ error: '购物车为空' }, 400);

  // 自动迁移
  await migrateToCampaigns(env);

  // 获取 campaignId（默认 1）
  const campaignId = Number(body.campaignId) || 1;

  // 从团单读取商品
  const campaignProducts = await getCampaignProducts(env, campaignId);
  if (campaignProducts.length === 0) {
    return json({ error: '该团单暂无商品' }, 400);
  }

  // 读取库存和订单
  let stock = await getCampaignStock(env, campaignId);
  let orders = await getCampaignOrders(env, campaignId);

  // 校验库存（含赠品）
  for (const it of items) {
    const p = campaignProducts.find(x => x.productId === Number(it.id));
    if (!p) return json({ error: `货品不存在: ${it.id}` }, 400);
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty <= 0) return json({ error: `数量无效: ${p.name}` }, 400);
    if (qty % p.step !== 0) return json({ error: `「${p.name}」需按 ${p.step} 的倍数选择` }, 400);
    const remain = stock[p.productId] ?? p.total;
    const take = calcTake(p, p.promotionRules, qty);
    if (take > remain) {
      const gift = calcGift(p.promotionRules, qty);
      return json({ error: `「${p.name}」剩余 ${remain}，选 ${qty} 需 ${take}（含赠品 ${gift}）` }, 409);
    }
  }

  // 扣减库存 + 生成订单项
  const orderItems = items.map(it => {
    const p = campaignProducts.find(x => x.productId === Number(it.id));
    const qty = Number(it.qty);
    const take = calcTake(p, p.promotionRules, qty);
    stock[p.productId] = (stock[p.productId] ?? p.total) - take;
    const gift = calcGift(p.promotionRules, qty);
    const subtotal = calcPrice(p, p.promotionRules, qty);
    return {
      id: p.productId,
      productId: p.productId,
      name: p.name,
      qty,
      unit: p.unit,
      subtotal,
      gift,
      promotionApplied: gift > 0 ? describePromotion(p.promotionRules) : ''
    };
  });

  const total = orderItems.reduce((s, x) => s + x.subtotal, 0);
  const order = {
    campaignId,
    name, contact, note,
    items: orderItems,
    total,
    time: formatTime(new Date()),
    pickupCode: generatePickupCode(orders),
    pickedUp: false
  };
  orders.push(order);

  try {
    await saveCampaignStock(env, campaignId, stock);
    await saveCampaignOrders(env, campaignId, orders);
  } catch (e) {
    return json({ error: '保存失败，请重试' }, 500);
  }

  return json({ ok: true, order, stock });
}

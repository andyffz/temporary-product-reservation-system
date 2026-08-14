import {
  getCampaigns, getCampaignProducts, getCampaignStock, getCampaignOrders,
  describePromotion, migrateToCampaigns,
  handleOptions, json
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// GET /api/state → 兼容旧前端，返回第一个 active 团单的数据
// GET /api/state?campaignId=X → 返回指定团单的数据
export async function onRequestGet({ request, env }) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  // 自动迁移
  await migrateToCampaigns(env);

  const url = new URL(request.url);
  const campaignId = Number(url.searchParams.get('campaignId'));

  const campaigns = await getCampaigns(env);
  if (campaigns.length === 0) {
    return json({ error: '暂无团单' }, 404);
  }

  // 找到目标团单
  let campaign;
  if (campaignId) {
    campaign = campaigns.find(c => c.id === campaignId);
  } else {
    campaign = campaigns.find(c => c.status === 'active') || campaigns[0];
  }

  if (!campaign) return json({ error: '团单不存在' }, 404);

  const products = await getCampaignProducts(env, campaign.id);
  const stock = await getCampaignStock(env, campaign.id);
  const orders = await getCampaignOrders(env, campaign.id);

  // 确保库存记录完整
  let stockChanged = false;
  products.forEach(p => {
    if (stock[p.productId] == null) {
      stock[p.productId] = p.total;
      stockChanged = true;
    }
  });

  // 附加描述和库存
  const productsWithInfo = products.map(p => ({
    ...p,
    id: p.productId,
    remain: stock[p.productId] ?? p.total,
    promotionDesc: describePromotion(p.promotionRules)
  }));

  return json({
    campaign,
    products: productsWithInfo,
    stock,
    orders,
    campaigns // 也返回所有团单列表，方便前端切换
  });
}

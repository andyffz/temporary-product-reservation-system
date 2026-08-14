import {
  getCampaigns, saveCampaigns, nextCampaignId,
  getCampaignProducts, saveCampaignProducts,
  getCampaignStock, saveCampaignStock,
  getCampaignOrders, saveCampaignOrders,
  migrateToCampaigns, formatTime,
  handleOptions, json, requireAuth
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// GET /api/campaigns → 团单列表（公开）
// POST /api/campaigns → 新建团单（需鉴权）
export async function onRequestGet({ env }) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  // 自动迁移
  await migrateToCampaigns(env);

  const campaigns = await getCampaigns(env);

  // 为每个团单附加订单数和商品数
  const result = [];
  for (const c of campaigns) {
    const orders = await getCampaignOrders(env, c.id);
    const products = await getCampaignProducts(env, c.id);
    result.push({
      ...c,
      orderCount: orders.length,
      productCount: products.length
    });
  }

  return json({ campaigns: result });
}

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

  const name = (body.name || '').toString().trim();
  if (!name) return json({ error: '团单名称不能为空' }, 400);

  const endTime = (body.endTime || '').toString().trim();
  const description = (body.description || '').toString().trim();

  // 确保迁移完成
  await migrateToCampaigns(env);

  const campaigns = await getCampaigns(env);
  const id = nextCampaignId(campaigns);
  const now = formatTime(new Date());

  const campaign = {
    id,
    name,
    startTime: now,
    endTime,
    status: 'active',
    description,
    createdAt: now
  };

  campaigns.push(campaign);
  await saveCampaigns(env, campaigns);

  // 初始化空商品、库存、订单
  await saveCampaignProducts(env, id, []);
  await saveCampaignStock(env, id, {});
  await saveCampaignOrders(env, id, []);

  return json({ ok: true, campaign });
}

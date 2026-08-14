import {
  getCampaigns, getCampaignOrders,
  handleOptions, json
} from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

// GET /api/myOrders?contact=XXX&name=YYY → 查询用户在各团单的订单（公开）
export async function onRequestGet({ request, env }) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  const url = new URL(request.url);
  const contact = (url.searchParams.get('contact') || '').trim();
  const name = (url.searchParams.get('name') || '').trim();

  if (!contact && !name) return json({ error: '请提供联系方式或姓名' }, 400);

  const campaigns = await getCampaigns(env);
  const result = [];

  for (const c of campaigns) {
    const orders = await getCampaignOrders(env, c.id);
    const matched = orders.filter(o => {
      if (contact && o.contact === contact) return true;
      if (name && o.name === name) return true;
      return false;
    });
    if (matched.length > 0) {
      result.push({
        campaignId: c.id,
        campaignName: c.name,
        campaignStatus: c.status,
        orders: matched
      });
    }
  }

  return json({ groups: result, total: result.reduce((s, g) => s + g.orders.length, 0) });
}

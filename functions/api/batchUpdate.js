import { handleOptions, initialState, json, requireAuth } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
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

  const action = body.action; // 'pickup' | 'cancelPickup' | 'delete'
  const indices = Array.isArray(body.indices) ? body.indices.map(Number) : [];

  if (!action || !['pickup', 'cancelPickup', 'delete'].includes(action)) {
    return json({ error: '无效的操作类型' }, 400);
  }
  if (indices.length === 0) return json({ error: '未选择订单' }, 400);

  let state;
  try {
    const raw = await kv.get('state');
    state = raw ? JSON.parse(raw) : initialState();
  } catch (e) {
    state = initialState();
  }
  if (!Array.isArray(state.orders)) state.orders = [];

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  let affected = 0;

  // 按索引降序处理，避免删除时索引偏移
  const sortedIndices = [...new Set(indices)].filter(i => Number.isInteger(i) && i >= 0 && i < state.orders.length).sort((a, b) => b - a);

  if (action === 'delete') {
    for (const idx of sortedIndices) {
      state.orders.splice(idx, 1);
      affected++;
    }
  } else if (action === 'pickup') {
    for (const idx of sortedIndices) {
      if (!state.orders[idx].pickedUp) {
        state.orders[idx].pickedUp = true;
        if (!state.orders[idx].pickedUpAt) state.orders[idx].pickedUpAt = ts;
        affected++;
      }
    }
  } else if (action === 'cancelPickup') {
    for (const idx of sortedIndices) {
      if (state.orders[idx].pickedUp) {
        state.orders[idx].pickedUp = false;
        delete state.orders[idx].pickedUpAt;
        affected++;
      }
    }
  }

  try {
    await kv.put('state', JSON.stringify(state));
  } catch (e) {
    return json({ error: '保存失败' }, 500);
  }

  return json({ ok: true, orders: state.orders, affected });
}

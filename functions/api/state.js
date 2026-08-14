import { initialState, json, handleOptions } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet({ env }) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  let state;
  try {
    const raw = await kv.get('state');
    state = raw ? JSON.parse(raw) : null;
  } catch (e) {
    return json({ error: '读取失败' }, 500);
  }

  if (!state) {
    state = initialState();
    await kv.put('state', JSON.stringify(state));
  }
  return json(state);
}

import { initialState, json, handleOptions } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost({ env }) {
  const kv = env.T1_KV;
  if (!kv) return json({ error: 'KV 未绑定' }, 500);

  const state = initialState();
  try {
    await kv.put('state', JSON.stringify(state));
  } catch (e) {
    return json({ error: '重置失败' }, 500);
  }
  return json({ ok: true, state });
}

import { destroySession, json, handleOptions, requireAuth } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  await destroySession(env, auth.token);
  return json({ ok: true, message: '已退出登录' });
}

import { ADMIN_USERNAME, getAdminPassword, createSession, json, handleOptions } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: '请求格式错误' }, 400);
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!username || !password) {
    return json({ error: '用户名和密码不能为空' }, 400);
  }

  const expectedPassword = getAdminPassword(env);

  if (username !== ADMIN_USERNAME || password !== expectedPassword) {
    return json({ error: '用户名或密码错误' }, 401);
  }

  try {
    const { token, session } = await createSession(env, username);
    return json({
      ok: true,
      token,
      username: session.username,
      expiresAt: session.expiresAt
    });
  } catch (e) {
    return json({ error: '创建会话失败：' + e.message }, 500);
  }
}

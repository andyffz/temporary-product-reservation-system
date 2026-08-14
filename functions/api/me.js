import { json, handleOptions, requireAuth } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  return json({
    ok: true,
    username: auth.username,
    authenticated: true
  });
}

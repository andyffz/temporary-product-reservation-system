import { getProducts, saveProducts, handleOptions, json, requireAuth } from './_lib.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: '请求格式错误' }, 400);
  }

  const id = Number(body.id);
  if (!id) return json({ error: '商品 ID 无效' }, 400);

  const products = await getProducts(env);
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return json({ error: '商品不存在' }, 400);

  const p = { ...products[idx] };

  if (body.name != null) {
    const name = body.name.toString().trim();
    if (!name) return json({ error: '商品名称不能为空' }, 400);
    p.name = name;
  }
  if (body.unit != null) p.unit = body.unit.toString().trim();
  if (body.price != null) {
    const price = Number(body.price);
    if (isNaN(price) || price < 0) return json({ error: '价格无效' }, 400);
    p.price = price;
  }
  if (body.priceLabel != null) p.priceLabel = body.priceLabel.toString().trim();
  if (body.step != null) {
    const step = Number(body.step);
    if (step < 1 || !Number.isInteger(step)) return json({ error: '步进值须为正整数' }, 400);
    p.step = step;
  }
  if (body.total != null) {
    const total = Number(body.total);
    if (!Number.isInteger(total) || total < 0) return json({ error: '库存无效' }, 400);
    p.total = total;
  }
  if (body.date != null) p.date = body.date.toString().trim();
  if (body.dateType != null) p.dateType = body.dateType.toString().trim();
  if (body.note != null) {
    const note = body.note.toString().trim();
    if (note) p.note = note; else delete p.note;
  }

  products[idx] = p;
  await saveProducts(env, products);

  return json({ ok: true, product: p, products });
}

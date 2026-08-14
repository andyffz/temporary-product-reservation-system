import { getProducts, saveProducts, nextProductId, handleOptions, json, requireAuth } from './_lib.js';

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

  const name = (body.name || '').toString().trim();
  if (!name) return json({ error: '商品名称不能为空' }, 400);

  const unit = (body.unit || '个').toString().trim();
  const price = Number(body.price);
  if (isNaN(price) || price < 0) return json({ error: '价格无效' }, 400);

  const step = Number(body.step) || 1;
  if (step < 1 || !Number.isInteger(step)) return json({ error: '步进值须为正整数' }, 400);

  const total = Number(body.total) || 0;
  const date = (body.date || '').toString().trim();
  const dateType = (body.dateType || 'ok').toString().trim();
  const note = body.note ? body.note.toString().trim() : '';

  const priceLabel = body.priceLabel ? body.priceLabel.toString().trim() :
    step > 1 ? `${price} 元 ${step} ${unit}` : `${price} 元 / ${unit}`;

  const products = await getProducts(env);
  const id = nextProductId(products);

  const product = { id, name, unit, price, priceLabel, step, total, date, dateType };
  if (note) product.note = note;

  products.push(product);
  await saveProducts(env, products);

  return json({ ok: true, product, products });
}

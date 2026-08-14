// 共享：货品定义、初始库存、CORS 工具

export const PRODUCTS = [
  { id: 1, name: '海笋',            unit: '包', price: 10,    priceLabel: '10 元 3 包',   step: 3, total: 18, date: '2026.8.2',    dateType: 'expired', note: '已过期' },
  { id: 2, name: '光中杏仁',        unit: '包', price: 12,    priceLabel: '12 元 / 包',   step: 1, total: 5,  date: '2026.12.16',  dateType: 'ok' },
  { id: 3, name: '芥末花生',        unit: '罐', price: 5,     priceLabel: '5 元 / 罐',    step: 1, total: 5,  date: '2026.1 生产', dateType: 'ok' },
  { id: 4, name: '微辣热干面',      unit: '包', price: 3,     priceLabel: '3 元 / 包',    step: 1, total: 1,  date: '2025.12 生产', dateType: 'ok' },
  { id: 5, name: '榛子仁巧克力豆',  unit: '盒', price: 10,    priceLabel: '10 元 / 盒',   step: 1, total: 2,  date: '2027.2',      dateType: 'ok' },
  { id: 6, name: '道家火锅料',      unit: '包', price: 29.9,  priceLabel: '29.9 元 3 包', step: 3, total: 87, date: '2026.11.2',   dateType: 'ok' },
  { id: 7, name: '斋九福素鱼香肉丝', unit: '袋', price: 14.9,  priceLabel: '14.9 元 / 袋（买二赠一）', step: 1, total: 36, date: '2026.10.16',  dateType: 'ok', deal: '买二赠一' }
];

export function initialState() {
  const stock = {};
  PRODUCTS.forEach(p => { stock[p.id] = p.total; });
  return { stock, orders: [] };
}

// 买二赠一：赠品数 = floor(qty / 2)，库存扣 qty + 赠品，付款只算 qty
export function calcGift(product, qty) {
  if (product.deal === '买二赠一' && qty >= 2) return Math.floor(qty / 2);
  return 0;
}
export function calcTake(product, qty) {
  return qty + calcGift(product, qty);
}

export function calcPrice(product, qty) {
  if (product.step > 1) return (qty / product.step) * product.price;
  // 买二赠一：赠品免费，只付买的数量
  return qty * product.price;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

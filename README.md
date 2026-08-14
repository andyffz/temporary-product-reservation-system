# 临时商品预定系统

> 临时商品预定系统 - 用于管理临时商品的预定流程和库存状态

基于 Cloudflare Pages + Pages Functions + KV 构建的轻量级商品预定（接龙）系统，适用于云仓调回货品、内部特惠等场景的临时性商品预定与库存管理。

## 项目简介

本系统为临时性商品（食品、零食等）提供在线预定能力，支持实时库存扣减、订单管理、促销规则（如买二赠一）与过期商品标记。前端为静态页面，后端基于 Cloudflare Pages Functions（无服务器），数据持久化使用 Cloudflare KV，具备低成本、高可用、免运维的特点。

## 功能说明

### 预定功能（用户端 `index.html`）
- 商品列表展示，含价格、单位、库存、生产/过期日期
- 购物车多商品下单，支持姓名、联系方式、备注
- 阶梯销售（按倍数购买，如 `10 元 3 包`）
- 买二赠一促销自动计算（赠品免费、库存含赠品扣减）
- 库存不足实时校验与友好提示
- 过期商品高亮标记

### 管理功能（管理端 `admin.html`）
- 查看当前库存与全部订单
- 库存调整：支持直接设置新值（`set`）或相对增减（`delta`）
- 订单更新与维护
- 一键重置状态、清空订单

### API 接口（`functions/api/`）
| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/state` | GET | 获取当前库存与订单状态 |
| `/api/order` | POST | 提交预定订单（含库存校验与扣减） |
| `/api/updateOrder` | POST | 更新订单信息 |
| `/api/updateStock` | POST | 调整库存（set / delta 两种模式） |
| `/api/reset` | POST | 重置为初始状态 |
| `/api/clearOrders` | POST | 清空全部订单 |

所有接口支持 CORS（`OPTIONS` 预检）。

## 技术栈

- **运行时**：Cloudflare Pages Functions（Workers 运行时）
- **存储**：Cloudflare KV（绑定名 `T1_KV`）
- **语言**：JavaScript（ES Modules）
- **前端**：原生 HTML / CSS / JavaScript（无构建步骤）
- **部署**：Cloudflare Pages

## 项目结构

```
.
├── functions/
│   └── api/
│       ├── _lib.js          # 共享：货品定义、库存与价格计算、CORS 工具
│       ├── state.js         # 获取库存与订单状态
│       ├── order.js         # 提交预定订单
│       ├── updateOrder.js   # 更新订单
│       ├── updateStock.js   # 调整库存
│       ├── reset.js         # 重置状态
│       └── clearOrders.js   # 清空订单
├── public/
│   ├── index.html          # 用户预定页
│   └── admin.html          # 管理后台
├── wrangler.jsonc          # Cloudflare Pages 配置
├── .gitignore
├── LICENSE
└── README.md
```

## 安装指南

### 前置要求
- [Node.js](https://nodejs.org/) 18+ 
- [Cloudflare 账号](https://dash.cloudflare.com/)
- Wrangler CLI（可选，用于本地开发与部署）

### 本地开发

1. 克隆仓库
   ```bash
   git clone https://github.com/<your-username>/temporary-product-reservation-system.git
   cd temporary-product-reservation-system
   ```

2. 安装 Wrangler
   ```bash
   npm install -g wrangler
   ```

3. 登录 Cloudflare
   ```bash
   wrangler login
   ```

4. 创建 KV 命名空间并写入 ID
   ```bash
   wrangler kv namespace create T1_KV
   ```
   将返回的 `id` 填入 `wrangler.jsonc` 中 `kv_namespaces` 的 `id` 字段。

5. 本地启动开发服务器
   ```bash
   wrangler pages dev public --kv T1_KV
   ```
   默认访问 `http://localhost:8788`。

### 部署到 Cloudflare Pages

```bash
wrangler pages deploy public --project-name t1-order
```

## 配置说明

`wrangler.jsonc` 关键配置：

```jsonc
{
  "name": "t1-order",
  "compatibility_date": "2026-08-12",
  "pages_build_output_dir": "public",
  "kv_namespaces": [
    { "binding": "T1_KV", "id": "<你的-KV-命名空间-ID>" }
  ]
}
```

- `pages_build_output_dir`：静态资源目录（`public/`）
- `kv_namespaces`：KV 绑定，代码通过 `env.T1_KV` 读写状态

## 商品与促销规则

商品定义位于 `functions/api/_lib.js` 的 `PRODUCTS` 数组，每个商品包含：`id`、`name`、`unit`、`price`、`priceLabel`、`step`（购买倍数）、`total`（初始库存）、`date`、`dateType`（`ok`/`expired`）等字段。

促销规则：
- **阶梯销售**（`step > 1`）：数量须为 `step` 的倍数，价格 = `(qty / step) * price`
- **买二赠一**（`deal: '买二赠一'`）：赠品数 = `floor(qty / 2)`，库存扣减 `qty + 赠品`，付款只计算 `qty`

## 版本控制与分支策略

本项目采用 Git 分支管理：

- `main`：生产环境代码，受分支保护，仅通过 Pull Request 合并
- `develop`：开发环境代码，日常开发集成于此

典型工作流：
```bash
# 基于 develop 创建功能分支
git checkout develop
git checkout -b feature/your-feature

# 开发完成提交
git add .
git commit -m "feat: 描述你的改动"

# 推送并创建 PR 到 develop
git push -u origin feature/your-feature

# develop 测试通过后，通过 PR 合并到 main 进行发布
```

## 许可证

[MIT License](./LICENSE)

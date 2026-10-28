# banana-image

本地运行的 AI 绘图画室，使用 Nuxt 4、Vertex AI、MySQL 和 Redis。详细设计见 `docs/PLAN.md`。

## 本地准备

1. 安装 Node.js 22.19+，运行 `npm install`。
2. 复制 `.env.example` 为 `.env`，填写数据库、Redis 和 GCP 配置。
3. 执行 `gcloud auth application-default login` 配置 ADC，并在 GCP 项目启用 Vertex AI API。
4. 创建 `utf8mb4` 数据库 `banana_image`。

## 开发

```bash
npm run dev
npm run dev:worker
```

Web 默认监听 `http://127.0.0.1:3000`。生成任务由独立 Worker 消费，两个进程需要同时运行。

```bash
npm run typecheck
npm run probe:models
npm run check:classnames
```

模型探测默认只读取元数据。确认模型、配额和费用后，可运行 `npm run probe:models -- --generate` 进行实际出图探测。

## 生产

```bash
npm run build
npm run worker
node .output/server/index.mjs
```

生产环境应分别守护 Web 与 Worker 进程，并将 `DB_SYNCHRONIZE` 设为 `false`。图片写入 `storage/`，不会打包进前端静态资源。

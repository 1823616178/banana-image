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

## 登录与多用户

- 所有页面和 `/api/*`（除登录、注册、`/api/health`）都需要登录；会话保存在 `user_sessions` 表，浏览器只持有 HttpOnly Cookie `bi_session`（30 天）。
- 首次打开会跳到 `/login`，**第一个注册的账号**自动成为管理员，并接管登录功能上线前留下的旧任务与图片。之后注册默认关闭，管理员可在「设置」页开关注册；`.env` 中 `ALLOW_REGISTRATION=true` 会强制开放。
- 管理员可修改共享限额（每日预算、每分钟任务数、赠金）、模型单价、注册开关，维护共享风格预设与常用提示词，并在「设置 → 用户管理」中调整角色、停用账号、重置密码。普通用户可查看共享限额，并维护只属于自己的预设与提示词。
- 任务、图片、上传参考图、文件读取、收藏、删除、用量统计和创作默认值都按登录用户隔离；每日预算、限流阈值、单价表为所有账号共享。
- 密码使用 scrypt 加盐哈希；通过 HTTPS 部署时设置 `COOKIE_SECURE=true`。

## 测试

```bash
npm run test                       # 单元测试；未配置测试库时跳过集成测试
BI_TEST_MYSQL_URL=mysql://root:pass@127.0.0.1:3307/bi_test npm run test   # 多用户隔离集成测试（会清空该库！）
npm run check                      # 类型检查 + className 检查 + 测试
```

## 生产

```bash
npm run build
npm run worker
node .output/server/index.mjs
```

生产环境应分别守护 Web 与 Worker 进程，并将 `DB_SYNCHRONIZE` 设为 `false`；关闭同步后需先执行 `docs/migrations/001-auth-and-ownership.sql` 建立登录相关表和字段，再执行 `docs/migrations/002-admin-and-library.sql`。图片默认写入 `storage/`，不会打包进前端静态资源。

## FTP 主存储

在 `.env` 中配置 `FTP_HOST`、`FTP_PORT`、`FTP_USER`、`FTP_PASSWORD`、`FTP_DIR`（如 `/banana`）后，FTP 成为图片主存储：

- 上传的参考图与生成图（原图 + 缩略图）先上传到 FTP，成功后才写入数据库、任务才标记完成；失败自动重试 3 次，并返回具体错误（无法连接、登录失败等）。
- 数据库 `images.storage` 记录存储位置（`ftp` / `local`），`filePath`、`thumbPath` 即 FTP_DIR 下的相对路径。
- 浏览器通过 `/api/files/...` 服务端代理读取（校验登录与归属，FTP 凭据不外泄），`?download=1` 以附件下载，支持 Range。
- Worker 与 Vertex 参考图输入同样从 FTP 读取。服务端使用 `FTP_POOL_SIZE` 个连接的连接池；`storage/.ftp-cache` 为按 `FTP_CACHE_MAX_MB` 限制大小的本地缓存，FTP 才是唯一可信来源。
- 旧的本地图片可执行 `npm run storage:migrate-ftp` 上传到 FTP 并更新数据库（不删除本地文件，可重复执行）。关闭数据库同步的环境需先执行 `docs/migrations/003-ftp-storage.sql`。
- 设置页“检测 MySQL / Redis / Vertex / FTP”可检查 FTP 连接。

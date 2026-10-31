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

配置 `SENSENOVA_API_KEY` 后可使用 SenseNova U1.5 Lite。无参考图时调用文生图接口，有参考图时调用图像编辑接口；最多支持 5 张，第一张为主编辑图。参考图由服务端读取本地或 FTP 文件并转换为 Base64 Data URL，无需公开图片链接。支持 1K / 2K / 4K，宽高按官方要求对齐到 32 像素，比例限制为 1:3 到 3:1。接口参数见 [SenseNova 官方文档](https://platform.sensenova.cn/docs)。

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

## Ubuntu 部署（22.04 / 24.04）

项目已在 Linux（Node 24）上验证过安装、类型检查、构建、测试、Web 与 Worker 启动。

1. 安装 Node.js 22.19+ 或 24.11+（Ubuntu 自带 apt 版本过旧，建议用 NodeSource 或 nvm）。sharp 会自动安装 linux-x64 预编译包，无需额外编译工具。
2. 将代码放到如 `/opt/banana-image`，执行 `npm ci`（Worker 通过 `tsx` 运行，需要保留 devDependencies，不要加 `--omit=dev`），再 `npm run build`。
3. 编写 `.env`（建议 LF 换行，权限 `chmod 600 .env`）；`STORAGE_DIR` 建议写绝对路径，并确保运行用户对其可写（FTP 模式下用于 `.ftp-cache` 缓存）。
4. 新数据库首次部署执行 `NODE_ENV=production npm run db:sync` 建表并写入初始数据；已有库升级执行 `docs/migrations/*.sql`。
5. GCP 凭据：服务器上执行 `gcloud auth application-default login`，或设置 `GOOGLE_APPLICATION_CREDENTIALS=/path/key.json`。
6. Web 进程不会自动读取 `.env`，需由 systemd `EnvironmentFile` 注入；监听地址用 `HOST`/`PORT`（或 `NITRO_HOST`/`NITRO_PORT`）。Worker 会自行读取工作目录下的 `.env`。

systemd 示例（`/etc/systemd/system/banana-web.service`，Worker 同理把 `ExecStart` 换成 `/usr/bin/npm run worker`）：

```ini
[Unit]
Description=banana-image web
After=network.target

[Service]
WorkingDirectory=/opt/banana-image
EnvironmentFile=/opt/banana-image/.env
Environment=NODE_ENV=production HOST=127.0.0.1 PORT=3000
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=always
User=banana

[Install]
WantedBy=multi-user.target
```

FTP 使用被动模式（EPSV/PASV），服务器防火墙需放行 FTP 服务端的 21 端口和被动端口范围。

### PM2 启动与升级

首次启动：安装 PM2 并完成构建后运行 `npm run start:pm2`，成功后 `pm2 save`。Web 默认监听 `127.0.0.1:50080`。Web 和 Worker 都读取 `.env`；凭据遵循外部环境变量、`.env` 和 Google 默认凭据发现机制，不在 PM2 配置中强制指定路径。

**从旧版本升级必须独占切换，不能滚动混跑。** Redis 队列名称带 `v2` 仍不足以隔离旧 worker：旧代码每 60 秒扫描同一个数据库的所有排队任务，会把新任务搬回旧队列。新增数据库版本字段也无法约束已经运行的旧代码。

1. 先停止所有连接此数据库的 Web/API 入口，暂停外部任务提交。PM2 可执行 `pm2 stop banana-web`；systemd、容器及其他主机也要停止对应入口。
2. 首次迁移时保留旧 worker 排空队列，在数据库执行下面的只读查询，等待 `queued` 和 `running` 都为 0。旧 PM2 条目的停机等待可能只有 15 秒，不能直接对正在生成的进程执行重启或删除。失败任务会保留在数据库中，升级后可在任务页重试。

   ```sql
   SELECT status, COUNT(*) AS count
   FROM generations
   WHERE status IN ('queued', 'running')
   GROUP BY status;
   ```

3. 停止所有旧 worker 及其自动重启来源，包括其他 checkout、`tsx watch`、其他用户的 PM2、systemd、容器和其他主机。PM2 执行 `pm2 stop banana-worker`，再 `pm2 delete banana-web banana-worker` 并 `pm2 save`，清除旧条目缓存的凭据和进程参数。若从 systemd 迁移，还需 `sudo systemctl disable --now banana-worker.service banana-web.service`。如果队列无法排空，先排查失联 worker / 上游故障，不要带着未完成任务强制切换。
4. 更新代码、安装依赖并运行 `npm run check && npm run build`，然后 `npm run start:pm2` 和 `pm2 save`。启动检查发现本机仍有 `server/worker.ts` / worker watch 进程或旧 PM2 条目时会拒绝启动；它不能检查远端主机，远端旧进程必须在步骤 3 中停止。新 worker 会从数据库恢复排队和租约过期的任务。

新配置直接用 Node + `--import tsx` 运行 worker，让退出信号直接到达任务进程。收到信号后停止领取任务，放回停机期间刚弹出的任务，等待在途生成、保存和队列恢复完成后再关闭连接。PM2 `kill_timeout` 为 900 秒，覆盖最多 4 次生成/下载（每次 120 + 30 秒）、7 秒退避和存储余量；存储长时间不可用或机器强制断电仍可能触发任务恢复。systemd 部署的 Worker 同样应配置 `TimeoutStopSec=900`（参见 [PM2 停机文档](https://pm2.keymetrics.io/docs/usage/signals-clean-restart/)）。

# banana-image 任务完成情况核查

核查日期：2026-10-28（北京时间）。依据为 [PLAN.md](./PLAN.md) 第 7 节、当前工作区源码及本次实际执行结果。

## 核查口径与汇总

- **已完成**：对应实现存在，且本次本地检查已验证该任务的主要验收要求。
- **待验收**：核心代码已经实现，依赖 MySQL、Redis 或 Vertex 的验收尚未完成，不能视为已完成。
- **部分完成**：已有部分实现，但存在明确缺项、已复现缺陷，或尚缺该项要求的交互/视觉验收。
- **未完成**：主要功能尚未实现；仅有实体、依赖或占位页面不算完成。

任务列表实际为 **37 项**，其中 **33 项必选、4 项可选**；原文“38 个任务”为计数错误。任务数量不能用于推算工作量完成百分比。

| 阶段 | 已完成 | 待验收 | 部分完成 | 未完成 | 总计 |
|---|---:|---:|---:|---:|---:|
| Phase 0 环境与脚手架 | 3 | 0 | 1 | 0 | 4 |
| Phase 1 基础设施连通 | 0 | 4 | 1 | 0 | 5 |
| Phase 2 后端核心：生成流程 | 1 | 5 | 1 | 0 | 7 |
| Phase 3 后端：作品与设置 | 1 | 0 | 1 | 2 | 4 |
| Phase 4 前端设计系统 | 1 | 0 | 3 | 0 | 4 |
| Phase 5 前端页面 | 1 | 0 | 1 | 4 | 6 |
| Phase 6 联调与测试 | 0 | 0 | 1 | 2 | 3 |
| Phase 7 打磨（可选） | 0 | 0 | 1 | 3 | 4 |
| **合计** | **7** | **9** | **10** | **11** | **37** |
| **必选项小计** | **7** | **9** | **9** | **8** | **33** |

## 本次验证结果

| 检查 | 结果 |
|---|---|
| `npm run typecheck` | 通过，退出码 0 |
| `npm run check:classnames` | 通过，共检查 84 个类名 |
| `npm run build` | 通过，生成 `.output/server/index.mjs`；有构建性能提示，不影响成功结果 |
| `npm run dev -- --host 127.0.0.1 --port 3048` | 启动成功；核查进程设置 `DB_SYNCHRONIZE=false`，避免验证时自动修改数据库 |
| 5 个页面路由 | `/`、`/gallery`、`/image/1`、`/tasks`、`/settings` 均返回 HTTP 200，HTML 均包含公共导航 |
| ADC | `gcloud auth application-default print-access-token` 成功；未输出或保存 token |
| Git 与环境文件 | `.git` 存在；`.env`、`storage/`、`node_modules/` 被忽略；`.env.example` 存在，**`.env` 不存在**；相关 DB、Redis、GCP 项目环境变量未设置 |
| 存储冒烟检查 | 临时目录内分别保存生成图与上传图；原图、WebP 缩略图、年月目录、尺寸、SHA-256 和读回检查通过；测试图片已清理 |
| 文件路径检查 | 7 种非法路径被 service 以 400 拒绝；HTTP 原始 `../`、单次编码及双次编码路径均返回 400；不存在文件返回 404 |
| 生成参数校验 | `POST /api/generations {}`、非法列表状态、非法任务 ID 均返回 400 |
| 费用计算 | 按张估算及 token 单价计算的本地冒烟检查通过 |
| 错误分类 | 429、401、403、404、安全拦截、仅文字返回的分类冒烟检查通过；**本地超时错误分类失败，详见下文** |
| `/api/health` | HTTP 200，响应内 `database`、`redis`、`vertex` 均为 `error`；没有满足三项均为 `ok` 的验收标准 |
| 缺失接口 | `/api/images`、`/api/images/1`、`/api/presets`、`/api/templates`、`/api/settings`、`/api/models`、`/api/stats/usage` 的 GET 请求均返回 404，源码中也没有相应路由实现 |

MySQL 实际报 `ECONNREFUSED 127.0.0.1:3306`；Redis 连接失败；Vertex 提示缺少 `GOOGLE_CLOUD_PROJECT`。ADC 可用不代表项目、模型、权限、配额和实际出图已验证。本次未执行真实 Vertex 图像生成。

浏览器访问 host 不可用；随后 Windows UI 工具因无法可靠识别当前浏览器 URL 而停止。已停止 UI 自动化，改用 HTTP 和静态检查；**主题切换、动画和 375px/平板视觉效果未完成浏览器验收**。

以下本地冒烟检查不替代任务 6.2 要求的持久化 Vitest 单元测试。

## 每项任务

### Phase 0 环境与脚手架

| 任务 | 状态 | 证据与剩余工作 |
|---|---|---|
| 0.1 初始化 Nuxt 4、安装依赖、启动页面 | 已完成 | [package.json](../package.json) 已配置 Nuxt 4；依赖已安装；开发服务启动，首页 HTTP 200；类型检查及生产构建通过。 |
| 0.2 环境文件、忽略规则、Git 初始化 | 部分完成 | `.git`、[.env.example](../.env.example)、[.gitignore](../.gitignore) 均存在，忽略规则有效；缺少真实 `.env`。当前全部项目文件仍为 untracked，尚无已跟踪项目文件。 |
| 0.3 SCSS 全局注入 | 已完成 | [nuxt.config.ts](../nuxt.config.ts) 注入 tokens/mixins；包含 `$cadmium-yellow` 的主题样式成功编译。 |
| 0.4 本地 ADC 检查 | 已完成 | 本次 `gcloud auth application-default print-access-token` 成功。 |

### Phase 1 基础设施连通

| 任务 | 状态 | 证据与剩余工作 |
|---|---|---|
| 1.1 TypeORM DataSource 与 6 张表 | 待验收 | [data-source.ts](../server/db/data-source.ts)、[01.db.ts](../server/plugins/01.db.ts)、6 个实体、显式列类型、`utf8mb4` 和装饰器配置齐全；开发环境默认开启 synchronize，生产关闭。本次 DB 不通，未验证真实建表。 |
| 1.2 ioredis 插件 | 待验收 | [redis.ts](../server/services/redis.ts)、[02.redis.ts](../server/plugins/02.redis.ts) 存在；health 已接入，但本次 Redis 为 `error`，未达到 `ok` 标准。 |
| 1.3 Vertex 封装并真实生成落盘 | 待验收 | [vertex.ts](../server/services/vertex.ts) 使用 `vertexai: true`、project/location；参考图、图像参数、返回图片解析均存在，落盘由 Worker 接续。缺项目配置，未验证真实生成落盘。 |
| 1.4 模型探测并写回 Setting | 部分完成 | [probe-models.ts](../scripts/probe-models.ts) 遍历模型及 `-preview`，默认查元数据，`--generate` 才实际出图；只输出可用列表，**没有写回 Setting 或更新默认模型的逻辑**，也未完成真实探测验收。 |
| 1.5 health 三项均正常 | 待验收 | [health.get.ts](../server/api/health.get.ts) 汇总 DB、Redis、Vertex，HTTP 返回结构正常；实际三项均为 `error`。Vertex 检查方式是模型元数据请求。 |

### Phase 2 后端核心：生成流程

| 任务 | 状态 | 证据与剩余工作 |
|---|---|---|
| 2.1 实体与可重复 seed | 待验收 | [seed.ts](../server/db/seed.ts) 初始化 5 个风格、默认设置、单价表与模板；风格/设置使用唯一键及 `orIgnore`，模板先查后插。尚未连接 DB 连续运行并核对记录数。除默认模型外，其余初始图片单价为 0，仍需配置。 |
| 2.2 原图、缩略图、SHA-256 | 已完成 | [storage.ts](../server/services/storage.ts) 本次真实写入并读回测试通过：`images/或uploads/YYYY/MM/UUID.png`、`thumbs/YYYY/MM/UUID.webp`、图片元数据与 64 位哈希均正确。 |
| 2.3 生成创建、校验、限流、预算、入队 | 待验收 | [index.post.ts](../server/api/generations/index.post.ts)、[generation.ts](../server/services/generation.ts)、[rateLimit.ts](../server/services/rateLimit.ts) 已串接；非法参数 HTTP 400 已验证。有效任务入库/入队、真实限流 429、预算 402 尚未联调。 |
| 2.4 Worker 完整生成流水线 | 待验收 | [worker.ts](../server/worker.ts) 与 [generationWorker.ts](../server/services/generationWorker.ts) 包含 BRPOP、锁、心跳、并发生成、保存、状态、cost、UsageStat 及清画廊缓存；未验证 count=3 的真实任务。实现是**独立 Worker 进程**，需要另行运行 `npm run dev:worker`，与 PLAN 的 Nitro 插件方案不同。 |
| 2.5 错误分类、退避与超时重试 | 部分完成 | 大部分分类及重试分支已实现，本地常见分类检查通过；但 `withTimeout` 抛出的中文“Vertex 图像生成超时”被分类为 `GENERATION_FAILED/never`，超时重试无法触发。尚无全链路状态与退避测试。 |
| 2.6 重启恢复、取消、重试 | 待验收 | 恢复逻辑及 retry/cancel 路由均存在；恢复依赖 Worker 和租约过期扫描。未做进行中重启和实际取消/重试测试；应重点验证中断后已保存图片的处理及取消与任务领取的竞态。 |
| 2.7 上传与参考图编辑 | 待验收 | [uploads.post.ts](../server/api/uploads.post.ts) 校验单张 7MB、存储并去重；生成 DTO 限制 14 张参考图，Worker 按 ID 读取并发送 inlineData。真实上传入库和编辑出图未联调，前端上传尚缺。 |

### Phase 3 后端：作品与设置

| 任务 | 状态 | 证据与剩余工作 |
|---|---|---|
| 3.1 图片列表、筛选、搜索、分页与缓存 | 未完成 | 没有 `/api/images` 列表实现，实测 404；Worker 中只有清理画廊缓存逻辑，没有查询及写缓存的配套功能。 |
| 3.2 详情、收藏、软删除、再次生成 | 未完成 | 相应 images 路由均缺失，详情 GET 实测 404。`Image.deletedAt`、`isFavorite` 字段及删除文件工具不能替代业务接口。 |
| 3.3 文件读取与防目录穿越 | 已完成 | [文件路由](../server/api/files/[...path].get.ts) 和 storage 校验存在；HTTP 原始及编码目录穿越均返回 400，正常缺失文件返回 404。文件内容当前由 `readFile` 读入 Buffer 返回，尚未采用设计中的流式输出。 |
| 3.4 presets/templates/settings/models/stats API | 部分完成 | [settings service](../server/services/settings.ts) 有读取、写入及缓存失效逻辑，实体/seed 已备好；但这 5 组对外路由均未实现，对应 GET 实测 404，未满足 curl 验收要求。 |

### Phase 4 前端设计系统

| 任务 | 状态 | 证据与剩余工作 |
|---|---|---|
| 4.1 tokens、字体、亚麻纹理与暗色主题 | 部分完成 | tokens、linen.png、亮暗 CSS 变量、[useTheme.ts](../app/composables/useTheme.ts) 及系统主题逻辑存在；只有字体族名称，**没有本地字体文件或 `@font-face`**。主题交互未完成浏览器验收。 |
| 4.2 笔触边框、泼溅 SVG、画框 mixin 与 demo | 部分完成 | 有 `painted-frame` mixin、CSS 泼溅 mixin、首页内联装饰 SVG；未找到笔触 `border-image`/`mask-image`、独立笔触 SVG 或 demo 页面，画框 mixin 也没有实际使用。 |
| 4.3 通用组件及 reduced-motion | 部分完成 | PaintButton、Toast、Empty、OptionChips、BrushLoading 均存在，CSS 有 reduced-motion 覆盖；动画交互尚未实测。BrushLoading 将 `stroke-dashoffset` 固定为 240，所用动画未改变它，尚未实现规划的笔触绘制动画。 |
| 4.4 Layout、NavBar、5 个路由 | 已完成 | 公共 Layout/NavBar 和页面文件齐全；HTTP 验证 5 个路由均可访问并包含导航。此项只确认公共框架与路由，不代表占位页业务已完成。 |

### Phase 5 前端页面

| 任务 | 状态 | 证据与剩余工作 |
|---|---|---|
| 5.1 创作全流程 | 部分完成 | [index.vue](../app/pages/index.vue) 有提示词、参数、静态单价估算、创建任务、1.5s 轮询、结果、下载/详情链接及出图动画；**缺少参考图上传/拖拽与风格预设 UI**，请求固定 `refImageIds: []`。默认参数与模型价格未从设置读取，真实出图未验收。 |
| 5.2 画廊瀑布流、筛选、收藏与无限滚动 | 未完成 | [gallery.vue](../app/pages/gallery.vue) 只显示“画廊正在布置中”；没有数据请求、瀑布流、筛选、收藏、分页/无限滚动，未验证 100 图性能。 |
| 5.3 详情与各项操作 | 未完成 | [image/[id].vue](../app/pages/image/[id].vue) 只显示等待详情接口；大图、元信息、下载、再次生成、编辑带图、删除均未实现。 |
| 5.4 任务列表与实时状态 | 未完成 | [tasks.vue](../app/pages/tasks.vue) 只有静态空状态；尚未调用已有任务 API，没有筛选、取消、重试、失败详情或刷新逻辑。 |
| 5.5 设置、统计、图表及默认值同步 | 未完成 | [settings.vue](../app/pages/settings.vue) 只有“设置面板正在准备中”；无费用卡片、图表、表单或连接测试按钮。首页使用写死的默认值和 `DEFAULT_MODELS`，不会同步服务端设置。 |
| 5.6 className 扫描脚本 | 已完成 | [check-classnames.mjs](../scripts/check-classnames.mjs) 使用正则检查 `.vue` 中的静态 class 与动态 class 的字符串字面量，放行 `is-*`；实测 84 个类名全部通过。动态运行时或框架自动附加类不属于该扫描覆盖范围。 |

### Phase 6 联调与测试

| 任务 | 状态 | 证据与剩余工作 |
|---|---|---|
| 6.1 文生图、编辑、收藏、删除、统计端到端走查 | 未完成 | 未发现 E2E 用例或既有验收记录；本次依赖未连通，且收藏、删除、统计接口和页面尚缺，无法完整打通。 |
| 6.2 cost/rateLimit/错误分类的 Vitest 单测 | 未完成 | 项目没有测试文件、Vitest 配置、直接 Vitest 依赖或 `test` 脚本。本次临时冒烟检查不能计作完成此项。 |
| 6.3 手机、平板响应式 | 部分完成 | Layout、NavBar、首页已有 960/760/420/390px 等媒体查询；未完成 375px 与平板视觉走查；其余业务页为占位，不能作为最终页面适配验收。 |

### Phase 7 打磨（可选）

| 任务 | 状态 | 证据与剩余工作 |
|---|---|---|
| 7.1 SSE 替代轮询 | 未完成 | 首页仍为 1.5s setTimeout 轮询，没有 EventSource 或 SSE 服务端实现。 |
| 7.2 访问口令中间件 | 未完成 | `.env.example` 有 `APP_ACCESS_PASSWORD` 占位，服务端没有读取或校验该变量，也没有访问口令中间件。 |
| 7.3 ZIP 批量下载与历史自动补全 | 未完成 | 未发现批量 ZIP、历史查询或自动补全实现。PromptTemplate 实体不等同于提示词历史功能。 |
| 7.4 生产构建与 Windows pm2 脚本 | 部分完成 | `npm run build` 本次通过，[README](../README.md) 有手动启动 Web/Worker 的说明；没有 pm2 依赖、ecosystem 配置或 Windows 启动脚本。生产服务与独立 Worker 的进程管理未验收。 |

## 已确认缺陷与设计差异

1. **超时不会重试（2.5）**：[vertex.ts](../server/services/vertex.ts) 使用 `withTimeout(..., 'Vertex 图像生成超时')`；[async.ts](../server/utils/async.ts) 抛出普通 Error；[generationErrors.ts](../server/services/generationErrors.ts) 的超时分支只匹配 `timeout`、`timed.out`、`deadline.exceeded`。本次用 5ms 定时器经过同一工具函数，实际结果为 `{ code: 'GENERATION_FAILED', retry: 'never' }`，应为 `{ code: 'VERTEX_TIMEOUT', retry: 'timeout' }`。这不是单纯缺少外部环境，而是已复现的代码问题。
2. **模型探测不落库（1.4）**：脚本收集 `available` 后只打印，没有调用 `writeSetting` 或数据库写入逻辑。
3. **Worker 的运行方式已变化（2.4/2.6）**：当前为独立进程，`npm run dev` 不会启动消费循环。需要同时运行 `npm run dev:worker`；后续应统一 PLAN 与 README 的部署约定。
4. **Redis 任务缓存尚未用于查询**：[generation.ts](../server/services/generation.ts) 的 `setTaskStatus` 会写状态/进度，但 `getGeneration` 始终查询 MySQL，没有实现设计中“先读 Redis，读不到再查 MySQL”的路径，也没有在返回 DTO 中提供该进度。
5. **默认值与价格尚未形成设置闭环（5.1/5.5）**：首页使用硬编码默认参数和静态 `DEFAULT_MODELS`；服务端 Setting 的更新不会影响首页。除默认模型外，初始单价为 0，会使服务端的按张预算估算缺乏有效价格，应在开放这些模型前完成价格配置与同步。

## 后续顺序建议

1. 补齐本项目 `.env`，验证 MySQL/Redis，执行并复查 seed 与建表，再完成 Vertex 最小生成、模型探测落库及 Worker 联调。
2. 修复超时分类，验证 count=3、上传编辑、429/402、错误状态、取消/重试和中断恢复。
3. 实现 Phase 3 缺失 API，再接通首页上传及画廊、详情、任务、设置页面。
4. 补本地字体、笔触/画框展示、Vitest、E2E 与移动端浏览器验收；最后处理 Phase 7 可选项。

本次修改范围仅为核查文档与任务状态，不包含业务代码修复。

## 2026-10-29 增量：登录、多用户隔离与画廊/任务/设置

本节记录 2026-10-29（北京时间）新增功能及实际验证结果，上表各项原状态保持不变，以本节为准。

| 项目 | 状态 | 说明 |
|---|---|---|
| 登录/注册/退出/改密 | 已完成（本地验证） | `users`、`user_sessions` 两表；scrypt 加盐哈希；HttpOnly Cookie `bi_session` 30 天；首个账号可注册并接管旧数据，之后需 `ALLOW_REGISTRATION=true`；登录/注册 10 分钟 10 次限流（单进程内存）。 |
| 任务与用户绑定 | 已完成（本地验证） | `generations.userId`、`images.userId`；任务列表/详情/取消/重试、上传、参考图、画廊、详情、收藏、删除、再次生成、`/api/files` 文件读取均按当前用户过滤；限流按用户计。 |
| 3.1 `/api/images` 列表 | 已完成（缓存未验收） | 搜索、模型、比例、收藏、排序、分页；Redis 缓存按用户分 key，Redis 未连接时直接查库。缓存命中未在真实 Redis 上验证。 |
| 3.2 详情/收藏/软删除/再次生成 | 已完成（本地验证） | 删除时清理磁盘文件；同哈希图片删除后可再次保存。 |
| 3.4 settings/models/stats/presets/templates | 部分完成 | 已有 GET 接口及 `PUT /api/settings`；presets 增删改、templates 新增/删除未做。创作默认值按用户保存，预算/限流/赠金为所有账号共享。 |
| 5.2 画廊页 | 已完成（未做浏览器视觉验收） | 瀑布流、筛选、收藏、无限滚动。 |
| 5.3 详情页 | 已完成（未做浏览器视觉验收） | 大图、参数、下载、收藏、再次生成、以此编辑（带参考图回到创作页）、删除。 |
| 5.4 任务页 | 已完成（未做浏览器视觉验收） | 状态筛选、分页、有进行中任务时 2.5 秒刷新、取消、重试、失败原因。 |
| 5.5 设置页 | 已完成（未做浏览器视觉验收） | 费用卡片、每日费用柱状图（CSS）、按模型统计、默认值表单、共享限额、连接测试、改密；首页读取服务端模型与用户默认值。 |
| 5.1 参考图上传 | 部分完成 | 首页新增上传/拖拽参考图；风格预设 UI 仍未做。 |
| 6.2 Vitest | 部分完成 | 新增 `npm run test`：密码哈希、参数校验、登录限流单测，以及多用户隔离集成测试（需 `BI_TEST_MYSQL_URL`）。cost/rateLimit/错误分类单测仍缺。 |

实际验证（Windows 本机，临时 MySQL 8.4 Docker 容器，用完已删除）：

- `npm run typecheck` 退出码 0；`npm run check:classnames` 通过，检查 214 个类名；`npm run build` 成功。
- `npx vitest run`（设置 `BI_TEST_MYSQL_URL`）：2 个文件 14 个用例全部通过。
- 生产构建 HTTP 冒烟：未登录访问 `/api/*` 返回 401，页面 302 到 `/login?redirect=…`；首个账号以外注册返回 403；错误密码 401；登录后 Cookie 为 HttpOnly；用户 A、B 的任务列表、默认值互不可见；他人的图片 404；`/api/files/..%2F.env` 返回 400；退出后再次请求 401。Redis 未连接时提交生成返回 503（预期行为）。
- 未验证：真实 Redis 缓存、Worker 真实出图与 userId 落库、浏览器交互与视觉效果。

注意：生产构建中 `NODE_ENV=production`，`DB_SYNCHRONIZE` 不生效，需先执行 `docs/migrations/001-auth-and-ownership.sql`。
## 2026-10-29 增量二：管理员、预设/提示词管理、6.2 单测与超时重试修复

| 项目 | 状态 | 说明 |
|---|---|---|
| 管理员角色 | 已完成（本地验证） | `users.role`（admin/user）、`users.disabled`；首个注册账号为管理员。共享限额（每日预算、每分钟任务数、赠金）、模型单价、注册开关只有管理员可改，普通用户在设置页只读查看。 |
| 用户管理 | 已完成（本地验证） | `GET /api/admin/users`、`PATCH /api/admin/users/:id`：改角色、停用/启用、重置密码；停用或重置密码会注销该用户全部会话；不能降级/停用自己，至少保留一个可用管理员。 |
| 注册开关 | 已完成（本地验证） | 设置项 `allowRegistration`；`.env` 的 `ALLOW_REGISTRATION=true` 仍会强制开放。 |
| 3.4 presets/templates 增删改 | 已完成（本地验证） | `userId` 为空的条目为共享（管理员维护），其余为个人条目，仅本人可见可改；首页新增风格预设与常用提示词选择；设置页新增两个管理面板。种子只写入一次（`seed:libraryVersion`），删除后重启不再补回。 |
| 2.5 超时不重试 | 已修复（单测验证） | `withTimeout` 改抛 `TimeoutError`，分类器优先识别并匹配中文“超时”；重试次数提取为 `shouldRetry`（配额 3、超时 1、临时故障 2）。真实 Vertex 超时场景未验证。 |
| 6.2 Vitest 单测 | 已完成 | `tests/unit/cost.test.ts`、`rateLimit.test.ts`（模拟 Redis）、`generationErrors.test.ts`。 |
| 标题乱码 | 无需修改 | `nuxt.config.ts` 与构建产物中的标题经逐字节核对均为正确 UTF-8（`banana-image · 让灵感落进颜料里`）；之前看到的乱码来自 Windows 终端显示。源码中未发现其他乱码。 |

实际验证（Windows 本机，临时 MySQL 8.4 容器，用完已删除）：

- `npm run typecheck` 退出码 0；`npm run check:classnames` 通过，261 个类名；`npm run build` 成功。
- `npx vitest run`（设置 `BI_TEST_MYSQL_URL`）：5 个文件 46 个用例全部通过。
- 生产构建 HTTP 冒烟：普通用户访问 `/api/admin/users` 返回 403，管理员 200；管理员降级自己返回 400（CANNOT_DEMOTE_SELF）；普通用户修改预算或单价返回 403，修改自己的默认值 200；管理员开放注册后 `/api/auth/status` 为开放，关闭后恢复；普通用户创建共享预设/提示词返回 403，个人条目 200；停用账号后该用户会话立即失效，登录返回 403（ACCOUNT_DISABLED）。
- 未验证：设置页与首页新面板的浏览器交互与视觉效果；真实 Redis/Vertex/Worker。

生产环境（关闭同步）需在 001 之后执行 `docs/migrations/002-admin-and-library.sql`。
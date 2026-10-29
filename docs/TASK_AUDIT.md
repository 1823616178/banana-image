# banana-image 全项目任务复核

核查日期：2026-10-29（北京时间）。当前结论：**10 项已完成、9 项待验收、14 项部分完成、4 项未完成**，共 37 项，与 [PLAN 任务列表](./PLAN.md#7-任务列表) 对应。

核查对象是当前工作区，包含已有未提交改动。检查范围覆盖 app 页面/组件/composables/样式、server API/中间件/DTO/实体/services/Worker、shared、scripts、迁移 SQL、配置与测试；未将第三方依赖、生成产物或字体名称视作功能完成证据。本轮仅更新两份核查文档，业务缺陷未修复。

勾选标准：原任务要求已实现且有对应验证证据。单测通过不等于真实模型、生产迁移或浏览器验收通过；历史验证会明确标注。此前增量记录中“已完成但未验收”的项目已按此标准统一归类。

## 本轮验证

- `npm run check`：类型检查通过；337 个 class 检查通过；首次单测 52 通过、12 跳过。
- 使用本轮新建、与实际数据库隔离的 MySQL 8.4 容器设置 `BI_TEST_MYSQL_URL` 后，`npm run test`：**8 个文件、64 项全部通过**。集成测试会清表，仅运行于临时库。
- `npm run build`：成功；生产产物在临时 MySQL/Redis 上启动成功。
- 生产 HTTP 冒烟：登录、首页、画廊、任务、设置及 images/generations/presets/templates/settings/models/stats/admin-users 的 GET 均 200。
- `/api/health`：database=ok、redis=ok、vertex=error、ftp=disabled。后两项是隔离测试配置，不是对用户真实 .env 连通性的判断。
- 临时运行脚本：8 张表、重复 seed 数量稳定；真实 Redis 缓存命中/用户缓存清除、创建任务入队、排队取消、429、402 均通过；同时复现默认设置缺失、预算不预留、认证错误分类丢失。未启动 Worker 消费这些任务。
- `.env` 存在且被忽略、未跟踪；本次 PATH 找不到 gcloud，ADC 未重新验收。
- 未做：真实 Vertex 收费生成/编辑、真实 FTP 通信及迁移、Worker 中断恢复、生产迁移、浏览器交互/视觉/100 图性能、375px/平板验收。FTP 测试模拟远端，实际执行 sharp 和本地缓存逻辑。

## 当前逐项状态（唯一现行汇总）

| 任务 | 勾选 | 状态 | 证据与剩余工作 |
|---|---|---|---|
| 0.1 初始化 Nuxt 4 项目（`npx nuxi init`），用 pnpm 或 npm 安装依赖 | ✅ | 已完成 | Nuxt 4 依赖、类型检查和生产构建通过；隔离环境生产服务及登录后首页 HTTP 200。 |
| 0.2 创建 `.env`、`.env.example`、`.gitignore`，`git init` | ✅ | 已完成 | 真实 .env、模板与 Git 仓库均存在；git ls-files .env 无输出，git check-ignore .env 命中。项目已有跟踪文件。 |
| 0.3 配置 SCSS 全局注入（tokens、mixins） | ✅ | 已完成 | nuxt.config.ts 注入 tokens/mixins；全站 SCSS 随生产构建成功编译。 |
| 0.4 本地检查 `gcloud auth application-default print-access-token` | ⬜ | 待验收 | 历史 2026-10-28 记录 ADC 成功；本次 shell 找不到 gcloud 命令，未重新验证 token，不能据此断言 ADC 已失效。 |
| 1.1 TypeORM DataSource 插件（synchronize: true，utf8mb4），解决装饰器配置问题 | ✅ | 已完成 | 临时 MySQL 8.4 实际初始化、同步实体成功，现为 8 张表（原 6 表加用户/会话）；64 项测试通过。生产迁移未实测。 |
| 1.2 ioredis 插件 | ✅ | 已完成 | 临时 Redis 7 连接成功，生产 /api/health 的 redis=ok，实际缓存/队列检查通过。 |
| 1.3 封装 `services/vertex.ts`（vertexai: true，project，location=global） | ⬜ | 待验收 | Vertex SDK、参考图和图片解析已实现；未调用真实收费模型，不能确认真实生成与落盘。 |
| 1.4 编写 `scripts/probe-models.ts`，逐个探测第 1 节表格中的模型 ID（包括带 `-preview` 的写法） | ⬜ | 部分完成 | probe-models.ts 可探测模型/preview，但结果只打印，没有写回 Setting；真实模型可用性未验证。 |
| 1.5 `/api/health` 汇总 DB、Redis、Vertex 的状态 | ⬜ | 待验收 | 隔离环境 health HTTP 200，database/redis=ok、vertex=error（测试进程未配置项目）、ftp=disabled；不能标为全部正常。 |
| 2.1 实体与 seed（风格预设、默认设置、单价表） | ⬜ | 部分完成 | 重复 seed 后预设/模板数量稳定；但 seed.ts 的 settings 数组未写库，实际 defaults/models/theme 记录均缺失。见缺陷 F1。 |
| 2.2 `services/storage.ts`：保存原图、用 sharp 生成 webp 缩略图、计算 sha256 | ✅ | 已完成 | 原图、WebP、SHA-256 与年月路径实现齐全；保留历史本地存储验收，本次真实 sharp 加模拟 FTP 的存取/回滚/缓存测试通过。真实 FTP 服务未验收。 |
| 2.3 `POST /api/generations`：zod 校验、限流、预算检查、入队 | ⬜ | 部分完成 | zod、用户参考图校验、真实 Redis 入队及 429/402 已验证；预算不预留排队费用，两笔合计超预算请求仍能放行。见 F2。 |
| 2.4 Worker：BRPOP、加锁、调用 Vertex、保存图片、更新状态、记录 cost、累加 UsageStat、清缓存 | ⬜ | 部分完成 | 独立 Worker 有 BRPOP/锁/心跳/保存/费用/清缓存；未验证真实 count=3，重启会重跑全部张数，终态后的 Redis 失败还可能跳过记账。见 F4。 |
| 2.5 错误分类（429 退避、安全拦截 blocked、认证、404、超时） | ⬜ | 部分完成 | 中文超时缺陷已修复且单测通过；认证错误经 Worker 包装后再次分类实测变成 GENERATION_FAILED，终态又统一写 GENERATION_INCOMPLETE。见 F5。 |
| 2.6 重启恢复、取消、重试接口 | ⬜ | 部分完成 | 普通排队取消实测成功；取消未检查条件更新 affected，和领取存在竞态；恢复缺少逐张幂等与旧 Worker 写入保护。见 F3/F4。 |
| 2.7 `POST /api/uploads` 和编辑模式（传入参考图） | ⬜ | 待验收 | 上传/拖拽、7MB/14 张限制、用户归属、去重与 inlineData 路径齐全；上传后真实模型编辑出图未验收。 |
| 3.1 `/api/images` 列表（筛选、搜索、分页）+ Redis 缓存 | ⬜ | 待验收 | 列表/筛选/分页与用户隔离测试通过；真实 Redis 缓存命中和用户缓存清除通过，Worker 新出图后的缓存失效仍待端到端验收。 |
| 3.2 详情、收藏、软删除（同时删除磁盘文件）、再次生成 | ⬜ | 部分完成 | 详情/收藏/软删除/再次生成接口存在，隔离测试通过；FTP 删除失败时已先软删，重试找不到记录；再次生成未真实出图。见 F6。 |
| 3.3 `/api/files/[...path]`，防目录穿越 | ✅ | 已完成 | 路径白名单、归属校验、下载和 Range 已实现；非法路径单测和文件归属集成测试通过；保留历史 HTTP 穿越验收。仍为 Buffer 返回。 |
| 3.4 presets、templates、settings、models、stats 接口 | ⬜ | 部分完成 | 全部接口已补齐，GET HTTP 200；个人默认值、管理员设置、预设/模板 CRUD 集成测试通过；统计遗漏推荐费用，尚无累计赠金口径。见 F7。 |
| 4.1 tokens、字体、亚麻纹理、暗色主题变量 | ⬜ | 部分完成 | tokens/纹理/三态主题代码存在；缺本地字体与 @font-face，浏览器主题交互未验收。 |
| 4.2 笔触边框、泼溅 SVG、画框 mixin | ⬜ | 部分完成 | 内联泼溅 SVG、画框 mixin 已有，详情有独立画框样式；缺笔触 border-image/mask-image 与 demo，mixin 未被调用。 |
| 4.3 通用组件 PaintButton、Toast、Empty、颜料块 Chip、BrushLoading | ⬜ | 部分完成 | 五类通用组件及 reduced-motion 样式存在；BrushLoading 的 stroke-dashoffset 仍固定，动画/无动效模式未浏览器验收。 |
| 4.4 Layout 和 NavBar | ✅ | 已完成 | 公共布局/导航和五个业务页面齐全，详情文件已实现；本次登录后首页/画廊/任务/设置 SSR HTTP 200，详情沿用历史路由证据。 |
| 5.1 创作页：参数面板、预估费用、参考图拖拽上传、生成、轮询、结果画布 | ⬜ | 部分完成 | 参数、服务端默认值/价格、上传、预设/推荐、提交/轮询/结果均存在；轮询一次网络失败即停止，running 状态仍禁用生成；缺结果区收藏/以此编辑，未真实出图。见 F8。 |
| 5.2 画廊：瀑布流、筛选、收藏、无限滚动 | ⬜ | 待验收 | 已实现 CSS columns、搜索筛选、收藏、懒加载与 IntersectionObserver/加载更多；缺 100 张图片及浏览器性能验收。 |
| 5.3 详情：画框大图、元信息、下载、再次生成、以此编辑（跳转到创作页并带入参考图）、删除 | ⬜ | 待验收 | 大图画框、参数、下载、复制、收藏、再次生成、ref 编辑跳转、删除已实现；缺浏览器操作验收，同批次其他图展示仍缺。 |
| 5.4 任务页：状态筛选、取消、重试、查看失败原因 | ⬜ | 待验收 | 已实现筛选、分页、取消/重试和失败详情；当前页有活动任务时每 2.5 秒刷新，未做 Worker 运行时浏览器实时验收。 |
| 5.5 设置页：费用卡片、图表、默认参数、预算、单价表、测试连接 | ⬜ | 部分完成 | 费用卡/CSS 柱图/按模型表/默认参数/限额/价格覆盖/连接测试/改密/管理面板均有；缺累计费用与全账户累计赠金口径，推荐费用不显示，浏览器默认值同步待验收。 |
| 5.6 className 规范检查：编写一个脚本，用正则扫描 `.vue` 文件中的 class | ✅ | 已完成 | npm run check:classnames 通过，337 个类名；脚本已支持新增 auth 页面，动态运行时附加类不在覆盖范围。 |
| 6.1 端到端走查：文生图、编辑、收藏、删除、统计 | ⬜ | 未完成 | 尚无真实 Vertex 文生图→编辑→收藏→删除→统计完整端到端验收；数据库集成测试与 HTTP 冒烟不能代替。 |
| 6.2 关键 service 的单元测试（cost、rateLimit、错误分类），使用 vitest | ✅ | 已完成 | cost/rateLimit/错误分类及认证/FTP/推荐单测齐全；本次临时 MySQL 下 8 个测试文件、64 项用例全部通过。 |
| 6.3 响应式适配（手机、平板） | ⬜ | 待验收 | 各业务页与登录页均有响应式样式；未进行 375px/平板浏览器布局、溢出与交互验收。 |
| 7.1 用 SSE 替代轮询。 | ⬜ | 未完成 | 首页仍 1.5 秒轮询、任务页 2.5 秒轮询，无 SSE/EventSource 实现。 |
| 7.2 可选的访问口令中间件（`APP_ACCESS_PASSWORD`）。 | ⬜ | 未完成 | 已有必选账号登录和用户隔离，但不是原任务指定的 APP_ACCESS_PASSWORD 可选口令；按原验收条件不勾选。 |
| 7.3 批量下载（zip）、提示词历史自动补全。 | ⬜ | 未完成 | 未实现 ZIP 批量下载或历史自动补全；常用提示词与 AI 推荐不等同于历史自动补全。 |
| 7.4 生产构建：`nuxt build` + pm2 启动脚本（Windows）。 | ⬜ | 部分完成 | 生产构建与隔离服务启动通过，README 有 Web/Worker 手动运行说明；没有 pm2 配置与 Windows 启动脚本。 |

## 缺陷与后续验收重点

以下“复现”为本轮实际执行结果；“静态确认”为可从控制流直接确定的问题，未声称已做并发/故障注入测试。

1. **F1 默认设置未 seed（复现）**：`server/db/seed.ts:17` 声明 settings，但函数只写预设、模板和版本标记，未插入默认设置；重复运行也被版本标记短路。临时库查询 defaults/models/theme 为 0 条。应幂等写入设置后再标记版本。
2. **F2 预算非硬上限（复现）**：`server/services/rateLimit.ts:20` 只读取已完成费用，不预留待执行任务费用；已花 0.90、预算 1.00 时，两个 0.08 的检查均通过。应原子预留并在终态结算/释放；推荐接口也应纳入预算检查，未知单价不应按零费用默默放行。
3. **F3 取消竞态（静态确认）**：`server/services/generation.ts:201` 条件更新后不检查 affected；如果 Worker 已把 queued 改为 running，仍删除队列项、写 canceled 缓存并返回成功。应以条件更新成功为准，否则返回 409/实际状态。
4. **F4 Worker 恢复与结算（静态确认）**：`server/services/generationWorker.ts:92` 每次重新执行 count 个请求，不扣除已保存图片；中途重启可能多出图、多收费。`generationWorker.ts:146` 与 `server/worker.ts:85` 终态更新只按 id，缺租约/版本校验；失去租约的旧 Worker 仍可能覆盖结果。`generationWorker.ts:159` 更新 Redis 失败会阻断后续记账，并由外层改成 failed。需逐张幂等、条件提交与可恢复结算，再测 count=3/断线/重启。
5. **F5 错误分类丢失（复现）**：403 首次归为 VERTEX_AUTH_FAILED，经 `new AppError(code, 中文提示, 502)` 包装后再次分类变成 GENERATION_FAILED；`generationWorker.ts:148` 又统一写 GENERATION_INCOMPLETE。应保留结构化分类/code；原中文超时缺陷已修复，不再作为未修复项。
6. **F6 删除不能失败重试（静态确认）**：`server/services/images.ts:131` 先 softDelete，再删除 FTP 文件；FTP 失败后 API 报错，下一次找不到已软删记录，残余远端文件无法通过同一接口重试清理。应引入可重试删除状态/清理任务，成功后完成软删与缓存失效。
7. **F7 费用统计口径不完整（静态确认）**：`server/services/promptRecommend.ts:55` 推荐费用写 usage_stats/Redis，`userSettings.ts:123` 页面统计只查 generations，推荐费用不会显示；`app/pages/settings.vue:56` 共享赠金减去单用户本月生成费用，既不是累计也不是全账户余额。应先统一用户归属与费用账本，再完成累计/赠金统计；当前 UI 虽注明“按本月”，仍不满足原计划。
8. **F8 首页轮询断线后卡住（静态确认）**：`app/pages/index.vue` 的 pollGeneration catch 仅 toast，不重试、不解除 running 状态；一次临时错误即可让生成按钮持续禁用至刷新。应退避重试或提供恢复操作；上传过程中也应避免抢先提交缺少参考图的任务。
9. **F9 管理员并发约束（静态确认，未压测）**：`server/services/auth.ts:67` 首用户 count 检查和 `admin.ts:35` 最后管理员 count 检查均无串行锁；事务本身不能保证这些跨行条件。首次并发注册可能产生多个首任管理员，两名管理员互相降级可能导致无管理员。应锁定固定配置行/采用串行化措施并补并发测试。

## 原计划之外的新增功能

- 登录、会话、改密、管理员权限和个人数据隔离：普通路径通过 12 项 MySQL 集成测试；并发角色约束见 F9，不能宣称所有边界已验收。
- 预设/常用提示词管理：个人/共享权限与使用次数测试通过，首页/设置面板已接入；浏览器交互待验收。
- FTP 主存储、本地缓存、Range、迁移脚本：代码存在，模拟 FTP 单测通过；真实 FTP、连接池/重试故障、迁移及删除一致性待验收。
- 假发提示词预设与多模态推荐：解析/去重/错误分类/模拟 SDK 测试通过；真实模型、自动推荐交互和费用预算闭环待验收。
- 模型价格覆盖：前后端逻辑已接入；本轮仅审查使用逻辑，没有重新核实外部模型 ID、价格或地区支持，源码“官方价格”注释不作为本轮外部事实验证。

建议先修复 F1–F8，补 F9 并发验证，再进行真实 Worker/Vertex/FTP 与浏览器端到端验收。Phase 7 保持可选。

## 历史记录（不代表当前状态）

下列为原文存档，保留之前的环境、验收和增量记录；如与上文冲突，以本轮汇总为准。

<details>
<summary>展开 2026-10-28 与 2026-10-29 早前核查记录</summary>

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
</details>

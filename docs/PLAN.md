# banana-image 项目规划（PLAN）

> 状态：开发中。已核查 37 项任务：7 项已完成、9 项待验收、10 项部分完成、11 项未完成；逐项依据见 [任务核查报告](./TASK_AUDIT.md)。
> 更新：2026-10-28（北京时间）

---

## 1. 项目概述与目标

**banana-image** 是一个本地运行的 AI 绘图 Web 应用。它通过 Google Cloud **Vertex AI** 调用 Gemini 图像模型（Nano Banana 系列），费用从 GCP 赠金中抵扣。

- **抵扣范围**：Vertex AI 上 Google 自家模型的费用可以用赠金抵扣；AI Studio 的 Gemini API Key 费用**不能**用赠金抵扣。所以本项目只走 Vertex。
- **认证方式**：使用本机已配置好的 gcloud ADC（Application Default Credentials），不需要 API Key。
- **SDK**：`@google/genai`，初始化参数为 `{ vertexai: true, project, location }`。

### 目标
1. 文生图：输入提示词，选择模型、比例、分辨率、张数后生成图片。
2. 图生图 / 编辑：上传参考图（可多张），在参考图基础上编辑。
3. 作品管理：画廊浏览、收藏、详情、下载、再次生成。
4. 任务队列：异步生成，实时查看进度，失败可重试。
5. 成本可视：按张估算花费，按天和按模型统计，帮你掌握赠金余量。
6. 风格：「画笔油彩美丽」，整体像油画画布。

### 范围决定
- **单用户、本地使用，默认不做登录**。服务只监听局域网或本机。如果以后要暴露到公网，可以加一个可选的访问口令（`APP_ACCESS_PASSWORD`，见 Phase 7）。
- 图片保存在本地磁盘，不用 GCS。

### 可用模型（已查官方文档，2026-10-28）

| 名称 | Model ID | 定位 | location |
|---|---|---|---|
| Nano Banana 2.1 | `gemini-nano-banana-2.1` | **默认**。GA，主力模型，支持 1K/2K/4K 和多轮编辑 | **仅 `global`** |
| Nano Banana Pro | `gemini-3-pro-image`（Vertex 部分页面写作 `gemini-3-pro-image-preview`） | 最高质量，适合复杂构图和文字渲染 | `global` |
| Nano Banana 2 | `gemini-3.1-flash-image`（或 `-preview`） | 上一代主力模型 | `global` |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | 最快、最便宜（Gemini API 文档中列出，Vertex 上需实测） | `global` |
| Nano Banana | `gemini-2.5-flash-image` | 旧版，作为兜底 | `global` |

来源：
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/nano-banana-2-1 （2.1：GA，仅 global；**不支持** seed/temperature/topP/topK；比例 1:1、3:2、2:3、3:4、4:3、4:5、5:4、9:16、16:9、21:9、1:4、4:1、1:8、8:1；分辨率 1K/2K/4K；每个 prompt 最多 14 张参考图；单张内联图片最大 7MB）
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-generation
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
- https://ai.google.dev/gemini-api/docs/image-generation

> 不同文档对 ID 是否带 `-preview` 后缀写法不一致。因此 **模型列表做成可配置项**（存在 Setting 表和 `.env` 中）。Phase 1 会写一个探测脚本，逐个调用模型，以实际能调通的结果为准。`GOOGLE_CLOUD_LOCATION` 固定为 `global`。

---

## 2. UI 设计

### 2.1 设计系统：「画笔油彩」

**色板**（灵感来自油画颜料）

| Token | Hex | 用途 |
|---|---|---|
| `$canvas-linen` | `#F4EBDC` | 主背景（亚麻画布色） |
| `$paper-cream` | `#FBF6EC` | 卡片、面板底色 |
| `$ink-umber` | `#3B2A20` | 主文字（焦赭墨色） |
| `$ink-soft` | `#6E5A4A` | 次要文字 |
| `$ultramarine` | `#2E4A9E` | 主色、链接（群青） |
| `$cadmium-yellow` | `#F2B629` | 强调色、生成按钮（镉黄，香蕉色） |
| `$vermilion` | `#D9482B` | 错误、收藏（朱红） |
| `$viridian` | `#2F8F6B` | 成功状态（翠绿） |
| `$rose-madder` | `#C8557A` | 点缀（茜草玫瑰） |
| `$prussian-night` | `#1C2433` | 暗色模式背景（普鲁士蓝夜色） |
| `$frame-gold` | `#B8893B` | 画框描边、分隔线 |

- **主渐变**（类似调色刀抹开的效果）：`linear-gradient(120deg, #F2B629, #D9482B 45%, #2E4A9E)`
- **暗色模式**：背景用 `$prussian-night`，卡片用 `#26303F`，文字用 `#EFE6D6`，强调色不变。支持 跟随系统 / 亮 / 暗 三种切换。

**字体**
- 标题：`"ZCOOL XiaoWei", "LXGW WenKai", "STKaiti", serif`（书法感）
- 正文：`"LXGW WenKai", "Noto Sans SC", "Microsoft YaHei", sans-serif`
- 英文点缀：`"Playfair Display"`
- 字体文件放在本地 `public/fonts`，避免依赖外网 CDN。

**质感**
- 画布纹理：全局背景叠一张可平铺的亚麻纹理 PNG，透明度 0.25，混合模式 `multiply`。
- 笔触边框：卡片和按钮使用 SVG 笔触 `border-image`，或者用 `mask-image` 做出不规则的毛边。
- 颜料飞溅：页角放置 SVG 泼溅点缀，各页面颜色不同。
- 阴影：暖色柔和投影，参数为 `0 6px 18px rgba(59,42,32,.18)`。
- 画框：作品详情的大图外面加一层金色内描边（`$frame-gold`），营造画框效果。

**组件外观**
- **按钮**：主按钮用镉黄底色，带笔触毛边；hover 时有一条颜料从左往右刷过（伪元素 `scaleX` 动画）。
- **输入框**：像纸张的底色，下边框是一道手绘笔触线；聚焦时笔触线变成群青色。
- **选择器（模型、比例）**：做成“颜料块” chip，选中后像颜料堆起来，带浮起和描边。
- **卡片**：纸色底、毛边、轻微随机旋转（±0.6°），像随手钉在墙上的画。
- **Toast**：做成水彩晕染色块。

**动画**
- 生成中：画布上有一支画笔来回涂抹，配合颜料逐渐晕开的 loading（SVG stroke-dashoffset 加模糊）。
- 出图：图片从模糊加饱和度为 0 的状态，过渡到清晰（0.8s），就像颜料慢慢干透。
- 页面切换：淡入，并带 8px 位移。
- 遵循 `prefers-reduced-motion`：用户关闭动效偏好时，不播放动画。

### 2.2 className 命名规范（必须遵守）

格式：`class="container_页面_功能_位置_自定义"`，使用英文小写，各段用下划线连接。
- **页面**：`layout` / `home` / `gallery` / `detail` / `tasks` / `settings` / `common`
- **功能**：`nav`、`prompt`、`options`、`upload`、`result`、`grid`、`filter`、`card`、`viewer`、`meta`、`actions`、`list`、`stats`、`form`、`toast` 等
- **位置**：`top` / `bottom` / `left` / `right` / `center` / `main` / `side` / `header` / `footer` / `item`
- **自定义**：描述具体元素，例如 `input`、`btn`、`title`、`wrap`

SCSS 使用嵌套写法，但最终输出的仍然是完整类名，不使用 BEM 的 `__`。状态类统一用 `is-active`、`is-loading` 这类附加类。

| 元素 | className |
|---|---|
| 全局顶栏 | `container_layout_nav_top_bar` |
| 顶栏 Logo | `container_layout_nav_left_logo` |
| 顶栏导航链接 | `container_layout_nav_center_link` |
| 主题切换 | `container_layout_nav_right_theme` |
| 创作页外层 | `container_home_page_main_wrap` |
| 提示词输入 | `container_home_prompt_top_input` |
| 负面/风格预设 | `container_home_prompt_top_preset` |
| 模型选择 | `container_home_options_side_model` |
| 比例选择 | `container_home_options_side_ratio` |
| 分辨率选择 | `container_home_options_side_resolution` |
| 张数选择 | `container_home_options_side_count` |
| 预估费用 | `container_home_options_bottom_cost` |
| 参考图上传区 | `container_home_upload_side_dropzone` |
| 参考图缩略图 | `container_home_upload_side_thumb` |
| 生成按钮 | `container_home_actions_bottom_generate` |
| 结果画布 | `container_home_result_center_canvas` |
| 结果单图 | `container_home_result_center_item` |
| 生成中动画 | `container_home_result_center_loading` |
| 画廊筛选栏 | `container_gallery_filter_top_bar` |
| 画廊搜索 | `container_gallery_filter_top_search` |
| 只看收藏开关 | `container_gallery_filter_top_favorite` |
| 瀑布流网格 | `container_gallery_grid_main_masonry` |
| 作品卡片 | `container_gallery_card_item_wrap` |
| 卡片收藏按钮 | `container_gallery_card_item_favorite` |
| 加载更多 | `container_gallery_grid_bottom_more` |
| 详情大图 | `container_detail_viewer_main_image` |
| 详情画框 | `container_detail_viewer_main_frame` |
| 提示词展示 | `container_detail_meta_side_prompt` |
| 参数列表 | `container_detail_meta_side_params` |
| 下载按钮 | `container_detail_actions_side_download` |
| 再次生成 | `container_detail_actions_side_regenerate` |
| 以此编辑 | `container_detail_actions_side_edit` |
| 删除 | `container_detail_actions_side_delete` |
| 任务列表 | `container_tasks_list_main_table` |
| 任务行 | `container_tasks_list_item_row` |
| 任务状态徽章 | `container_tasks_list_item_status` |
| 重试按钮 | `container_tasks_list_item_retry` |
| 设置表单 | `container_settings_form_main_wrap` |
| 默认模型 | `container_settings_form_main_model` |
| 费用统计卡 | `container_settings_stats_top_card` |
| 费用图表 | `container_settings_stats_main_chart` |
| 全局 Toast | `container_common_toast_top_item` |
| 空状态 | `container_common_empty_center_tip` |

### 2.3 页面清单与线框

页面路由：`/` 创作页、`/gallery` 画廊、`/image/[id]` 详情、`/tasks` 任务、`/settings` 设置。

**① 创作页 `/`**
```
┌──────────────────────────────────────────────────────────────┐
│ 🍌 banana-image     创作  画廊  任务  设置           ☀/🌙     │ nav_top
├──────────────────────┬───────────────────────────────────────┤
│ 提示词 ┌───────────┐ │                                       │
│        │ textarea  │ │        结果画布 result_center         │
│        └───────────┘ │   ┌─────────┐ ┌─────────┐             │
│ 风格预设 [油画][水彩]│   │  img 1  │ │  img 2  │  (生成中：  │
│ 模型   [2.1][Pro]... │   └─────────┘ └─────────┘   画笔动画) │
│ 比例   [1:1][3:4]... │   每张：收藏 / 下载 / 详情 / 以此编辑  │
│ 分辨率 [1K][2K][4K]  │                                       │
│ 张数   [1][2][3][4]  │                                       │
│ 参考图 ┌ 拖拽上传 ┐  │                                       │
│        └──────────┘  │                                       │
│ 预估 ≈ $0.068        │                                       │
│ [ 🎨 开始作画 ]      │                                       │
└──────────────────────┴───────────────────────────────────────┘
```
- 左侧面板宽度 360px；移动端改为上下排列。
- 支持 `Ctrl+Enter` 快捷生成。

**② 作品画廊 `/gallery`**
```
┌──────────────────────────────────────────────────────────────┐
│ 搜索[_____]  模型[全部▾]  比例[全部▾]  ☆只看收藏  排序[最新▾] │
├──────────────────────────────────────────────────────────────┤
│ ┌────┐ ┌──────┐ ┌────┐ ┌────┐                                │
│ │    │ │      │ │    │ │    │   瀑布流（CSS columns）         │
│ └────┘ │      │ └────┘ │    │   hover：提示词摘要 + ♥          │
│ ┌────┐ └──────┘ ┌────┐ └────┘                                │
│              [ 加载更多 / 无限滚动 ]                          │
└──────────────────────────────────────────────────────────────┘
```

**③ 作品详情 `/image/[id]`**
```
┌──────────────────────────────────────┬───────────────────────┐
│  ╔══════════════════════════════╗    │ 提示词（可复制）       │
│  ║                              ║    │ 模型 / 比例 / 分辨率   │
│  ║        大图（金色画框）      ║    │ 耗时 / 费用 / 时间     │
│  ║                              ║    │ 参考图缩略图           │
│  ╚══════════════════════════════╝    │ [下载][再次生成]       │
│   同批次其他图 ▢ ▢ ▢                 │ [以此编辑][♥][删除]    │
└──────────────────────────────────────┴───────────────────────┘
```

**④ 任务队列 `/tasks`**
```
┌──────────────────────────────────────────────────────────────┐
│ 筛选：[全部][排队][生成中][成功][失败]                       │
├────┬──────────────────┬────────┬──────┬────────┬────────────┤
│ #  │ 提示词摘要       │ 模型   │ 状态 │ 费用   │ 操作       │
│ 12 │ 星空下的向日葵…  │ 2.1    │ ●生成│ -      │ 取消       │
│ 11 │ 猫戴墨镜…        │ Pro    │ ✕失败│ $0     │ 重试 / 原因│
└────┴──────────────────┴────────┴──────┴────────┴────────────┘
```

**⑤ 设置 `/settings`**
```
┌──────────────────────────────────────────────────────────────┐
│ [今日花费 $1.2] [本月 $8.4] [累计 $23] [剩余赠金(手填) $100]  │
│ 近30天费用折线 / 按模型饼图                                  │
├──────────────────────────────────────────────────────────────┤
│ 默认模型▾  默认比例▾  默认分辨率▾  默认张数▾                  │
│ 每日预算上限 $____（超出后拒绝生成）  每分钟限速 __ 次        │
│ 模型单价表（可编辑）     主题：跟随系统/亮/暗                 │
│ GCP 项目 ID / location（只读，来自 .env） [测试连接]          │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 功能设计

### 3.1 功能清单
1. **文生图**：根据提示词、模型、比例（aspectRatio）、分辨率（imageSize）、张数生成图片。张数 N 的实现方式是并发发起 N 次请求，因为每次请求通常只返回 1 张图。
2. **图生图 / 编辑**：上传 1 到 14 张参考图（每张 ≤7MB），和提示词一起发送。也可以从详情页点“以此编辑”，带入原图。
3. **风格预设**：例如“油画”“水彩”“厚涂”，选中后在提示词后面自动拼接对应的风格描述，预设内容可以增删改。
4. **任务队列**：生成任务异步执行，前端每 1.5s 轮询一次任务状态（后续可升级为 SSE）。
5. **画廊**：筛选、搜索、收藏、分页，并带缓存。
6. **详情**：下载原图、再次生成（参数完全相同）、以此编辑、删除（同时删除磁盘文件）。
7. **成本统计**：记录每张图的估算费用，按天、按模型汇总；设置每日预算上限。
8. **连接测试**：检查 ADC、Vertex、MySQL、Redis 是否可用。

### 3.2 数据流
```
浏览器
  │ POST /api/generations {prompt, model, ratio, size, count, refImageIds}
  ▼
Nuxt Nitro server/api
  ├─ 参数校验（zod）
  ├─ Redis 限流（每分钟次数）+ 每日预算检查
  ├─ MySQL：写入 Generation(status=queued)
  ├─ Redis：LPUSH bi:queue:generation {generationId}
  └─ 立即返回 {generationId}
       ▼
Worker（Nitro plugin 内启动的常驻消费循环，并发数可配置，默认 2）
  ├─ BRPOP 取出任务 → 加锁 SET bi:lock:gen:{id} NX EX 300
  ├─ 更新 Redis 中的状态 bi:task:{id} = running / 进度
  ├─ @google/genai → Vertex AI (global) generateContent
  │     config: { responseModalities:['IMAGE'], imageConfig:{aspectRatio, imageSize} }
  ├─ 取出返回中的 inlineData → 保存到 storage/images/YYYY/MM/{uuid}.png
  │     并用 sharp 生成缩略图 storage/thumbs/...webp
  ├─ MySQL：写入 Image 记录，Generation 改为 succeeded，记录 usage 和 cost
  ├─ UsageStat 当天累加
  └─ 删除画廊缓存 bi:cache:gallery:*
浏览器轮询 GET /api/generations/:id，先读 Redis，读不到再查 MySQL
图片通过 GET /api/files/:path 读取（server route 做流式输出和路径校验）
```
- 图片存放在项目根目录的 `storage/` 下，不放进 `public/`，因为 public 在构建时会被打包，运行时新增的文件不能可靠访问。
- 服务重启后：把状态为 `queued` 和 `running` 的任务重新放回队列。

### 3.3 Redis 用途（key 前缀统一为 `bi:`）

| Key | 类型 | 用途 | TTL |
|---|---|---|---|
| `bi:queue:generation` | List | 生成队列 | - |
| `bi:task:{id}` | Hash | 任务状态、进度、错误信息 | 24h |
| `bi:lock:gen:{id}` | String | 防止同一任务被重复执行 | 300s |
| `bi:rl:gen:{yyyyMMddHHmm}` | String（INCR） | 每分钟限流 | 70s |
| `bi:cost:day:{yyyyMMdd}` | String（INCRBYFLOAT） | 当日花费，用于预算检查 | 48h |
| `bi:cache:gallery:{hash(query)}` | String（JSON） | 画廊分页缓存 | 60s |
| `bi:cache:settings` | String（JSON） | 设置缓存 | 写入时删除 |

### 3.4 错误处理

| 场景 | 识别方式 | 处理方式 |
|---|---|---|
| 配额或限流（429 / RESOURCE_EXHAUSTED） | HTTP 状态码 | 指数退避，最多重试 3 次；仍失败则标记 failed，提示“额度或频率受限” |
| 安全拦截 | `finishReason` 为 SAFETY / PROHIBITED_CONTENT / IMAGE_SAFETY，或返回中没有图片 | 不重试，标记 `blocked`，向用户显示原因并建议修改提示词 |
| 只返回文字没有图片 | parts 中没有 inlineData | 标记 failed，保存模型返回的文字说明 |
| 认证失败（401/403） | ADC 失效或没有权限 | 提示运行 `gcloud auth application-default login`，并检查项目是否开通了 Vertex AI API |
| 模型不存在（404） | 模型 ID 或 location 不对 | 提示到设置页修改模型 ID |
| 超时 | 超过 120s | 重试 1 次 |
| 超出每日预算 | Redis 中的当日花费加上本次预估超过上限 | 直接返回 402 并提示 |

### 3.5 成本估算
- 优先根据返回的 `usageMetadata`（输入 token 和输出 token）乘以单价计算；如果拿不到，就按“每张图固定价格”估算。
- 单价表存放在 Setting（`pricing` JSON）中，可以在设置页编辑。初始值参考官方价格页，例如 2.1：1K 约 $0.034、2K 约 $0.05、4K 约 $0.11。**价格以官方页面为准**。
- 赠金余额需要在设置页手动填写，然后用它减去本地统计的花费，作为参考值。真实余额以 GCP 控制台为准。

---

## 4. 数据库设计（TypeORM，`synchronize: true`）

数据库：MySQL `banana_image`，字符集 `utf8mb4`。所有表都有 `id`（bigint 自增），以及 `createdAt`、`updatedAt`。

**Generation（一次生成任务）**

| 字段 | 类型 | 说明 |
|---|---|---|
| prompt | text | 原始提示词 |
| finalPrompt | text | 拼接风格预设之后的提示词 |
| model | varchar(64) | 模型 ID |
| aspectRatio | varchar(8) | 如 `1:1` |
| imageSize | varchar(4) | `1K`/`2K`/`4K` |
| count | tinyint | 张数 |
| mode | enum('text2img','edit') | 生成模式 |
| refImageIds | json | 参考图 Image.id 列表 |
| stylePresetId | bigint null | 关联的风格预设 |
| status | enum('queued','running','succeeded','partial','failed','blocked','canceled') | 任务状态，**建索引** |
| errorCode / errorMessage | varchar(64) / text | 错误信息 |
| inputTokens / outputTokens | int | 用量 |
| costUsd | decimal(10,4) | 费用 |
| durationMs | int | 耗时 |
| parentImageId | bigint null | 用于“以此编辑”和“再次生成”的来源 |

索引：`(status, createdAt)`、`(model)`

**Image（单张图片，包括生成图和上传的参考图）**

| 字段 | 类型 | 说明 |
|---|---|---|
| generationId | bigint null | 外键，**建索引**；上传的参考图为空 |
| source | enum('generated','upload') | 来源 |
| filePath / thumbPath | varchar(255) | 相对于 storage 的路径 |
| mimeType | varchar(32) | 文件类型 |
| width / height | int | 尺寸 |
| bytes | int | 文件大小 |
| sha256 | char(64) | 文件哈希，**唯一索引**，用于去重 |
| isFavorite | boolean | 默认 false，**建索引** |
| deletedAt | datetime null | 软删除（`@DeleteDateColumn`） |

索引：`(source, isFavorite, createdAt)`

**StylePreset（风格预设）**：`name` varchar(32) 唯一、`promptSuffix` text、`coverImageId` bigint null、`sort` int、`enabled` boolean。初始数据包括：油画、水彩、厚涂、印象派、水墨。

**PromptTemplate（常用提示词）**：`title` varchar(64)、`content` text、`useCount` int。

**Setting（键值配置）**：`key` varchar(64) 唯一、`value` json。用于保存默认模型、比例、分辨率、张数、每日预算、限流、单价表、主题、赠金额度、模型列表。

**UsageStat（每日统计）**：`date` date、`model` varchar(64)、`images` int、`inputTokens` bigint、`outputTokens` bigint、`costUsd` decimal(10,4)。`(date, model)` 建唯一索引。

> 收藏只有单用户，所以直接用 `Image.isFavorite` 字段，不单独建 Favorite 表。如果以后要支持多用户，再拆出来。

---

## 5. API 设计（Nitro `server/api`）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/generations` | 创建生成任务，返回 `{id}` |
| GET | `/api/generations` | 任务列表（`?status=&page=`） |
| GET | `/api/generations/:id` | 任务状态及生成的图片 |
| POST | `/api/generations/:id/retry` | 重试 |
| POST | `/api/generations/:id/cancel` | 取消排队中的任务 |
| POST | `/api/uploads` | 上传参考图（multipart，单张 ≤7MB），返回 Image |
| GET | `/api/images` | 画廊（`?q=&model=&ratio=&favorite=&sort=&page=&size=`），带缓存 |
| GET | `/api/images/:id` | 作品详情 |
| PATCH | `/api/images/:id/favorite` | 切换收藏状态 |
| DELETE | `/api/images/:id` | 软删除，并清理磁盘文件 |
| POST | `/api/images/:id/regenerate` | 用相同参数再次生成 |
| GET | `/api/files/[...path]` | 读取 storage 中的图片或缩略图（防目录穿越） |
| GET/POST/PUT/DELETE | `/api/presets` | 风格预设的增删改查 |
| GET/POST/DELETE | `/api/templates` | 常用提示词 |
| GET/PUT | `/api/settings` | 读取或修改设置 |
| GET | `/api/stats/usage` | 费用统计（`?range=30d`） |
| GET | `/api/models` | 可用模型列表和单价 |
| GET | `/api/health` | 检查 MySQL、Redis、Vertex 的连通性 |

统一返回格式：`{ code: 0, data, message }`，出错时返回 `{ code, message }` 并带上对应的 HTTP 状态码。

---

## 6. 目录结构

```
E:\code\banana-image
├─ .env                  # 真实配置（不提交 git）
├─ .env.example          # 占位符模板
├─ .gitignore            # 忽略 .env、storage/、node_modules
├─ nuxt.config.ts
├─ package.json
├─ tsconfig.json
├─ docs/
│  └─ PLAN.md
├─ app/                  # Nuxt 4 目录结构
│  ├─ app.vue
│  ├─ layouts/default.vue
│  ├─ pages/
│  │  ├─ index.vue           # 创作
│  │  ├─ gallery.vue
│  │  ├─ image/[id].vue
│  │  ├─ tasks.vue
│  │  └─ settings.vue
│  ├─ components/
│  │  ├─ layout/NavBar.vue
│  │  ├─ home/PromptPanel.vue, OptionChips.vue, RefUploader.vue, ResultCanvas.vue, BrushLoading.vue
│  │  ├─ gallery/FilterBar.vue, MasonryGrid.vue, ImageCard.vue
│  │  ├─ detail/FramedViewer.vue, MetaPanel.vue
│  │  ├─ tasks/TaskTable.vue
│  │  ├─ settings/CostCards.vue, CostChart.vue, SettingsForm.vue
│  │  └─ common/PaintButton.vue, Toast.vue, Empty.vue
│  ├─ composables/useGeneration.ts, useGallery.ts, useSettings.ts, useTheme.ts
│  └─ assets/
│     ├─ scss/_tokens.scss, _mixins.scss, _textures.scss, _animations.scss, main.scss
│     ├─ textures/linen.png
│     └─ svg/brush-border.svg, splash-*.svg
├─ public/fonts/         # 本地字体
├─ server/
│  ├─ api/...            # 按第 5 节的接口
│  ├─ routes/            # 如有需要
│  ├─ plugins/
│  │  ├─ 01.db.ts            # TypeORM DataSource 初始化
│  │  ├─ 02.redis.ts         # ioredis
│  │  └─ 03.worker.ts        # 队列消费循环 + 重启后恢复任务
│  ├─ db/
│  │  ├─ data-source.ts
│  │  ├─ entities/Generation.ts, Image.ts, StylePreset.ts, PromptTemplate.ts, Setting.ts, UsageStat.ts
│  │  └─ seed.ts
│  ├─ services/
│  │  ├─ vertex.ts           # @google/genai 封装
│  │  ├─ generation.ts       # 业务逻辑
│  │  ├─ storage.ts          # 本地存储 + sharp 缩略图
│  │  ├─ cost.ts
│  │  └─ rateLimit.ts
│  └─ utils/response.ts, errors.ts, validate.ts
├─ scripts/probe-models.ts   # 探测可用模型
└─ storage/                  # 运行时生成（gitignore）
   ├─ images/  thumbs/  uploads/
```

### 关键依赖
`nuxt`、`typeorm`、`mysql2`、`reflect-metadata`、`ioredis`、`@google/genai`、`sharp`、`zod`、`sass`、`uuid`，以及图表库 `echarts` 或 `chart.js`（二选一，默认 chart.js，更轻量）。

**TypeORM 与 Nitro 的注意点**
- Nitro 默认使用 esbuild，**不会输出装饰器元数据**。因此实体需要显式写出列类型，例如 `@Column({ type: 'varchar' })`。
- 需要在 `nitro.esbuild.options` 里开启 `experimentalDecorators`，并在入口 `import 'reflect-metadata'`。
- 实体用数组直接导入（`entities: [Generation, ...]`），不要用 glob 路径。

### .env 变量（密码只写在 `.env` 中，本文档不出现）
```
DB_HOST=192.168.1.111
DB_PORT=53306
DB_USER=hanvon
DB_PASSWORD=          # 见 .env
DB_NAME=banana_image
REDIS_HOST=192.168.1.111
REDIS_PORT=56379
REDIS_PASSWORD=       # 见 .env
GOOGLE_CLOUD_PROJECT= # 你的 GCP 项目 ID
GOOGLE_CLOUD_LOCATION=global
DEFAULT_IMAGE_MODEL=gemini-nano-banana-2.1
STORAGE_DIR=./storage
WORKER_CONCURRENCY=2
APP_ACCESS_PASSWORD=  # 可选，留空表示不启用
```
`.env.example` 只放占位符，真实值写在 `.env` 中，并加入 `.gitignore`。

---

## 7. 任务列表

> 核查日期：2026-10-28。仅“已完成”勾选；“待验收”表示核心代码已实现，但外部依赖联调尚未通过；“部分完成”表示存在缺项、缺陷或交互/视觉验收缺口；“未完成”表示主要功能尚未实现。每项“验收”描述的是目标，实际情况见紧随其后的“核查”。详细证据见 [TASK_AUDIT.md](./TASK_AUDIT.md)。

### Phase 0 环境与脚手架
- [x] 0.1 初始化 Nuxt 4 项目（`npx nuxi init`），用 pnpm 或 npm 安装依赖。验收：`npm run dev` 能打开默认页面。
  - **核查：已完成。** 依赖已安装，开发服务启动成功，首页 HTTP 200，类型检查及生产构建通过。
- [ ] 0.2 创建 `.env`、`.env.example`、`.gitignore`，`git init`。验收：`.env` 没有被 git 跟踪。
  - **核查：部分完成。** Git 已初始化，模板和忽略规则存在且有效；真实 `.env` 缺失，当前项目文件均未跟踪。
- [x] 0.3 配置 SCSS 全局注入（tokens、mixins）。验收：页面能使用 `$cadmium-yellow` 变量。
  - **核查：已完成。** 全局注入配置存在，相关 SCSS 成功编译。
- [x] 0.4 本地检查 `gcloud auth application-default print-access-token`。验收：能输出 token。
  - **核查：已完成。** 本次成功取得 token，未输出或保存凭据。

### Phase 1 基础设施连通
- [ ] 1.1 TypeORM DataSource 插件（synchronize: true，utf8mb4），解决装饰器配置问题。验收：启动后 MySQL 中自动建出 6 张表。
  - **核查：待验收。** 插件、6 个实体与装饰器配置齐全；MySQL 不通，未验证真实建表。
- [ ] 1.2 ioredis 插件。验收：`/api/health` 中 redis 为 ok。
  - **核查：待验收。** 连接插件和 health 检查已实现，实测 Redis 为 error。
- [ ] 1.3 封装 `services/vertex.ts`（vertexai: true，project，location=global）。验收：用一个提示词能生成 1 张图并保存到磁盘。
  - **核查：待验收。** SDK 封装与 Worker 落盘代码存在；缺少 GCP 项目配置，未真实出图。
- [ ] 1.4 编写 `scripts/probe-models.ts`，逐个探测第 1 节表格中的模型 ID（包括带 `-preview` 的写法）。验收：输出可用列表，写回默认 Setting。
  - **核查：部分完成。** 脚本支持模型及 preview 探测，但没有写回 Setting；默认仅查元数据，实际出图需 `--generate`。
- [ ] 1.5 `/api/health` 汇总 DB、Redis、Vertex 的状态。验收：三项都显示 ok。
  - **核查：待验收。** 接口 HTTP 200，结构正常；实测三项均为 error。

### Phase 2 后端核心：生成流程
- [ ] 2.1 实体与 seed（风格预设、默认设置、单价表）。验收：seed 可以重复运行，不会产生重复数据。
  - **核查：待验收。** 实体、初始数据与防重复逻辑存在；未在真实数据库重复运行验证。
- [x] 2.2 `services/storage.ts`：保存原图、用 sharp 生成 webp 缩略图、计算 sha256。验收：文件和缩略图都按路径规则生成。
  - **核查：已完成。** 临时目录内验证生成图/上传图原图、WebP 缩略图、年月目录、尺寸、哈希和读回均通过。
- [ ] 2.3 `POST /api/generations`：zod 校验、限流、预算检查、入队。验收：非法参数返回 400；超出限流返回 429。
  - **核查：待验收。** 校验、限流、预算和入队已串接；HTTP 400 已验证，真实 429/402 和有效任务入队待联调。
- [ ] 2.4 Worker：BRPOP、加锁、调用 Vertex、保存图片、更新状态、记录 cost、累加 UsageStat、清缓存。验收：count=3 时生成 3 张图，状态为 succeeded。
  - **核查：待验收。** 流水线代码存在，count=3 未真实验证；当前采用独立 Worker，需另行启动 `npm run dev:worker`，与前述 Nitro 插件方案不同。
- [ ] 2.5 错误分类（429 退避、安全拦截 blocked、认证、404、超时）。验收：模拟各类错误后，状态和提示都正确。
  - **核查：部分完成。** 常见错误分类冒烟检查通过；已复现中文超时错误被归为 `GENERATION_FAILED/never`，无法触发超时重试。
- [ ] 2.6 重启恢复、取消、重试接口。验收：在任务进行中重启服务，任务能继续完成。
  - **核查：待验收。** 恢复、租约扫描、取消和重试代码存在；进行中重启及操作竞态尚未联调。
- [ ] 2.7 `POST /api/uploads` 和编辑模式（传入参考图）。验收：上传 1 张图，再加“改成油画风”的提示词，能出图。
  - **核查：待验收。** 上传、大小限制、去重、参考图读取与 inlineData 传递已实现；上传入库及编辑出图待验证，前端上传尚缺。

### Phase 3 后端：作品与设置
- [ ] 3.1 `/api/images` 列表（筛选、搜索、分页）+ Redis 缓存。验收：第二次请求命中缓存；新生成图片后缓存被清除。
  - **核查：未完成。** 列表接口及查询缓存缺失，实测 HTTP 404；仅有 Worker 清缓存逻辑。
- [ ] 3.2 详情、收藏、软删除（同时删除磁盘文件）、再次生成。验收：每个操作都有效。
  - **核查：未完成。** 对应 images 业务接口均缺失，详情 GET 实测 HTTP 404。
- [x] 3.3 `/api/files/[...path]`，防目录穿越。验收：请求 `../` 返回 400。
  - **核查：已完成。** service 的 7 种非法路径及 HTTP 原始/编码目录穿越检查通过，均返回 400；当前读取方式为 Buffer，尚非流式输出。
- [ ] 3.4 presets、templates、settings、models、stats 接口。验收：用 curl 测试全部通过。
  - **核查：部分完成。** settings service、实体和 seed 已有；这 5 组 API 路由均未实现，对应 GET 实测 HTTP 404。

### Phase 4 前端设计系统
- [ ] 4.1 tokens、字体、亚麻纹理、暗色主题变量。验收：亮暗主题切换正常。
  - **核查：部分完成。** tokens、纹理和三态主题代码已有；缺本地字体文件及 `@font-face`，主题交互未浏览器验收。
- [ ] 4.2 笔触边框、泼溅 SVG、画框 mixin。验收：有一个 demo 页展示效果。
  - **核查：部分完成。** 有内联装饰 SVG 和画框 mixin；缺笔触边框与 demo 页面，画框 mixin 尚未实际使用。
- [ ] 4.3 通用组件 PaintButton、Toast、Empty、颜料块 Chip、BrushLoading。验收：动画正常，开启 reduced-motion 后动画关闭。
  - **核查：部分完成。** 5 类组件及 reduced-motion 规则已有；动画未浏览器验收，BrushLoading 的 `stroke-dashoffset` 没有动画变化。
- [x] 4.4 Layout 和 NavBar。验收：5 个路由都能切换。
  - **核查：已完成。** 公共布局和导航齐全，5 个页面路由均返回 HTTP 200 并包含导航；占位页业务不计入本项。

### Phase 5 前端页面
- [ ] 5.1 创作页：参数面板、预估费用、参考图拖拽上传、生成、轮询、结果画布。验收：完整流程能出图，有出图动画。
  - **核查：部分完成。** 参数、静态估价、提交、轮询、结果及出图动画已有；缺上传/拖拽与风格预设，参考图固定为空，默认值和价格未接设置，未真实出图。
- [ ] 5.2 画廊：瀑布流、筛选、收藏、无限滚动。验收：加载 100 张图不卡顿（使用懒加载缩略图）。
  - **核查：未完成。** 当前仅为占位页，无数据请求、筛选、收藏、瀑布流或无限滚动。
- [ ] 5.3 详情：画框大图、元信息、下载、再次生成、以此编辑（跳转到创作页并带入参考图）、删除。验收：每个操作都有效。
  - **核查：未完成。** 当前仅显示等待详情接口，页面功能和操作尚缺。
- [ ] 5.4 任务页：状态筛选、取消、重试、查看失败原因。验收：状态实时刷新。
  - **核查：未完成。** 当前为静态空状态，未接已有任务 API，也没有刷新逻辑。
- [ ] 5.5 设置页：费用卡片、图表、默认参数、预算、单价表、测试连接。验收：修改后创作页的默认值同步变化。
  - **核查：未完成。** 当前为占位页，无设置表单、统计图表或连接测试；首页默认值写死。
- [x] 5.6 className 规范检查：编写一个脚本，用正则扫描 `.vue` 文件中的 class。验收：所有类名都符合 `container_页面_功能_位置_自定义` 格式（状态类 `is-*` 除外）。
  - **核查：已完成。** 扫描脚本存在，`npm run check:classnames` 实测 84 个类名全部通过。

### Phase 6 联调与测试
- [ ] 6.1 端到端走查：文生图、编辑、收藏、删除、统计。验收：全部打通。
  - **核查：未完成。** 依赖未连通，且收藏、删除、统计等功能缺失，无完整 E2E 验收记录。
- [ ] 6.2 关键 service 的单元测试（cost、rateLimit、错误分类），使用 vitest。验收：测试全部通过。
  - **核查：未完成。** 无测试文件、Vitest 配置、直接依赖或 test 脚本；本次临时冒烟检查不等于完成该项。
- [ ] 6.3 响应式适配（手机、平板）。验收：宽度 375px 时布局正常。
  - **核查：部分完成。** 现有布局与首页已有媒体查询；375px/平板视觉效果未验收，其余业务页仍为占位。

### Phase 7 打磨（可选）
- [ ] 7.1 用 SSE 替代轮询。
  - **核查：未完成。** 当前仍为 1.5s 轮询，无 SSE 服务端或 EventSource 实现。
- [ ] 7.2 可选的访问口令中间件（`APP_ACCESS_PASSWORD`）。
  - **核查：未完成。** 仅有 env 模板占位，没有服务端读取/校验或中间件。
- [ ] 7.3 批量下载（zip）、提示词历史自动补全。
  - **核查：未完成。** 两项功能均无实现。
- [ ] 7.4 生产构建：`nuxt build` + pm2 启动脚本（Windows）。
  - **核查：部分完成。** 生产构建通过，有手动启动说明；缺 pm2 配置和 Windows 启动脚本。

共 **8 个阶段（Phase 0–7）**，**37 个任务**，其中 33 个必选任务，Phase 7 的 4 个任务为可选。核查汇总：**7 项已完成、9 项待验收、10 项部分完成、11 项未完成**。

---

## 8. 风险与注意事项

1. **`synchronize: true` 只用于开发**：修改实体字段时可能会删掉对应的列和数据。上线或数据重要时，应该改用 migration。修改字段前先备份数据库。
2. **赠金范围**：赠金只抵扣 Vertex AI 上的 Google 模型费用，AI Studio 的 API Key 和 Claude 等第三方模型都不在范围内。赠金自注册起 90 天过期。建议在 GCP 控制台设置预算提醒。
3. **模型 ID 和地区会变化**：Preview 模型可能下线或改名，所以模型列表要做成可配置项，并用探测脚本确认。Nano Banana 2.1 只能用 `global`。
4. **2.1 不支持 seed 和 temperature**：如果传入这些参数，API 会直接报错，代码里不要传。
5. **配额与限流**：新项目的默认配额很低，容易返回 429。必要时到 GCP 控制台申请提额。
6. **安全拦截**：涉及真人、暴力等内容的提示词可能被拦截，被拦截的请求也可能产生输入 token 费用。
7. **TypeORM 与 Nitro 打包**：装饰器元数据需要特别处理（见第 6 节）。如果一直有兼容问题，备选方案是把实体定义改用 `EntitySchema` 写法。
8. **密钥安全**：`.env` 不要提交到 git；Redis 密码中有 `@` 字符，所以要用 host、port、password 分开配置，不要拼成 URL。
9. **网络**：本机访问 Google 需要走代理（Karing TUN 模式通常可以全局接管）。Node 进程如果不走 TUN，需要另外配置代理。MySQL 和 Redis 在内网 `192.168.1.111`，要确认代理不会拦截内网流量（把内网地址设为直连）。
10. **磁盘占用**：4K 图片每张可能有几 MB，需要定期清理软删除的文件。
11. **费用估算只是近似值**：真实费用以 GCP 账单为准。

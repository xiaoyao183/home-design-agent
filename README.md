# 装修落地效果预览

面向非技术用户的轻量网页：**上传房屋实拍图** + **上传参考效果图**，由后端调用 AI 将「效果意向」迁移到实拍照片上，帮助快速判断装修风格是否贴近预期。

## 功能说明

| 步骤 | 说明 |
|------|------|
| 上传实拍图 | 您家里的现状照片，尽量与效果图视角接近。 |
| 上传效果图 | 喜欢的设计参考（网络图、设计师稿均可）。 |
| 生成预览 | 默认可调用 **Replicate（Flux Kontext）**；也可切换为 **火山方舟 Seedream** 图生图（见下文环境变量）。 |

## 如何尽量满足「不改格局、保留光线」

纯软件无法像测量仪器一样保证毫米级不变，本项目通过两层手段**约束模型倾向**：

1. **提示词硬约束**：在服务端拼接英文指令，要求保留墙体/洞口/相机视角，并尽量保留原图光照与曝光。
2. **效果图语义**：若配置了 **多模态大模型**（OpenAI `gpt-4o-mini` 或 **DeepSeek** 等，见 `.env.example`），会先用其 **阅读效果图**并生成简短英文材质/配色描述，再与您在表单里写的中文说明合并，减少「只 upload 一张图却说不清要什么」的情况。

> **说明**：当前管线没有直接把两张图同时「像素对齐」融合进单一扩散模型；效果图通过「文字描述」间接影响生成。若自动描述不理想，请务必备注框里写清需求。

## 环境要求

- [Node.js](https://nodejs.org/) 18 或以上  
- 可访问互联网的机器（需调用 Replicate 或火山方舟等图像 API，可选多模态读图 API）

## 快速开始

1. **安装依赖**（在项目根目录执行）：

   ```bash
   npm install
   ```

2. **配置密钥**：复制 `.env.example` 为 `.env`，按你实际用的平台填写（**变量名和平台要一致，光把 Key 填进旧名字里不会自动换平台**）：

| 你要用 | 必设 | 说明 |
|--------|------|------|
| Replicate + OpenAI 读图 | `IMAGE_PROVIDER=replicate`，`REPLICATE_API_TOKEN` | 读图可配 `OPENAI_API_KEY` + 默认 `LLM_VISION_MODEL=gpt-4o-mini` |
| 火山 Seedream + DeepSeek 读图 | `IMAGE_PROVIDER=seedream`，`SEEDREAM_API_KEY`（或 Key 只写在 `REPLICATE_API_TOKEN` 时**必须**设 `IMAGE_PROVIDER=seedream`） | 读图：`LLM_PROVIDER=deepseek`，Key 放在 `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY` |

3. **启动服务**：

   ```bash
   npm start
   ```

4. 浏览器打开：**http://127.0.0.1:8787**（端口可通过环境变量 `PORT` 修改）。

## 如何得到「可分享的链接」（HTTPS）

我本人无法替你在云端开户并生成真实域名；链接会在你完成下面任一方式后，由平台自动给出。

### 方式 A：部署到 Render（推荐，免费 HTTPS）

**Render 是什么？** 可以理解成：租一台「一直开着的网上电脑」帮你跑这个网站，并免费送你一个以 **`onrender.com`** 结尾的 **https 链接**，别人在浏览器里输入就能打开。

**第二步到底在干什么？** 一句话：在 Render 里**登录 → 让 Render 能读你的 GitHub 仓库 → 用仓库里的 `render.yaml` 自动建网站 → 填上 API 密钥 → 等它装完，复制它给你的网址。下面按屏幕上的英文按钮，一步步写清楚（适合完全没做过的人跟着点）。

#### 0. 前提

- 代码已经在 **GitHub** 上（您已完成）。  
- 准备好 **Replicate** 的密钥：[Replicate API Tokens](https://replicate.com/account/api-tokens)（没有就先注册 Replicate，再复制 Token）。

#### 1. 打开 Render 并注册

1. 浏览器打开：**https://render.com/**  
2. 点 **Get Started for Free** 或 **Sign Up**，用 **GitHub 账号登录**（推荐，后面一步少很多麻烦）。

#### 2. 允许 Render 访问你的 GitHub（「连接仓库」）

1. 登录后进入 **Dashboard**（控制台首页）。  
2. 若提示 **Connect GitHub** / **Authorize Render**，按提示点同意，让 Render 能**看到你有哪些仓库**。  
3. 若问「给哪些仓库权限」，至少要包含你放本项目的那个仓库（可以选 **All repositories** 或 **Only select repositories** 里勾选你的项目）。

> 这就是之前文档里说的「注册并连接仓库」：**不是**把代码再传一遍，而是**授权 Render 从 GitHub 拉代码**。

#### 3. 用 Blueprint 部署（推荐：自动读 `render.yaml`）

1. 在 Dashboard 左上角点 **New +**（或 **New**）。  
2. 选 **Blueprint**（蓝图 = 按仓库里的配置文件自动搭服务）。  
3. **Connect a repository**：选中你推送本项目的 **GitHub 仓库**。  
4. **Branch** 一般选 **`main`**（若你默认分支是 `master` 就选 `master`）。  
5. **Blueprint file** 保持默认 **`render.yaml`**（本仓库根目录已有此文件）。  
6. 点 **Apply**（应用）。

#### 4. 填环境变量（密钥）

应用后会出现环境变量表单，至少填：

| 名字（必须一模一样） | 要不要填 | 去哪里拿 |
|----------------------|----------|----------|
| **`REPLICATE_API_TOKEN`** | **必填** | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |
| **`OPENAI_API_KEY`** | 可选 | 不配也能用，但「自动读效果图」会没有；要配去 [OpenAI API Keys](https://platform.openai.com/api-keys) |

- 值粘贴你的 Token 即可。  
- 若有 **Secret** / **Encrypt** 选项，勾选上，避免在页面上明文显示。

#### 5. 开始部署并拿链接

1. 点 **Create New Resources**（或类似「创建」按钮）。  
2. 等待 **Building** / **Deploying** 变绿或显示 **Live**（可能要几分钟）。  
3. 点进这个 **Web Service**，页面上方会有 **URL**，形如 **`https://xxxxx.onrender.com`**。  
4. 用浏览器打开这个地址，能进上传页面，就说明成功；**这个 https 地址就是可分享链接**。

> 免费版一段时间没人访问会「休眠」，朋友第一次打开可能要等 **30 秒～1 分钟** 唤醒，属正常现象。

#### 若找不到 Blueprint：用手动建 Web Service（效果相同）

1. **New +** → **Web Service**。  
2. 连接**同一个 GitHub 仓库**，分支选 `main` 或 `master`。  
3. **Runtime**：**Node**。  
4. **Build Command**：`npm install`  
5. **Start Command**：`npm start`  
6. **Environment** 里添加 **`REPLICATE_API_TOKEN`**（必填），可选 **`OPENAI_API_KEY`**。  
7. 创建并等待部署完成，同样复制页面上的 **URL** 即可。

### 方式 A-2：部署到 Railway

与 Render 类似，也是连 GitHub 后自动构建；本仓库的 **`package.json` 里已有 `npm start`**，一般**不用**再改启动命令。若你已在 Railway 上部署成功，请按下面核对即可。

1. **环境变量**  
   进入该服务的 **Variables**（变量）页，按你实际用的平台添加（**不要**把 Seedream 的 Key 只填在 `REPLICATE_API_TOKEN` 里却不改 `IMAGE_PROVIDER`，程序会仍按 Replicate 去调，必失败）：

   - 使用 **Replicate 出图**：`IMAGE_PROVIDER=replicate`，`REPLICATE_API_TOKEN`（[Replicate](https://replicate.com/account/api-tokens)）。  
   - 使用 **火山方舟 Seedream 出图**：`IMAGE_PROVIDER=seedream`，`SEEDREAM_API_KEY`（或把 Key 放在 `REPLICATE_API_TOKEN` 时**必须**同时设 `IMAGE_PROVIDER=seedream`）。  
   - 需要 **读效果图** 时：若用 **OpenAI**，设 `OPENAI_API_KEY`；若用 **DeepSeek**，可设 `DEEPSEEK_API_KEY` 或把 Key 写在 `OPENAI_API_KEY` 里，并**至少**加之一：`LLM_PROVIDER=deepseek` 或 `LLM_BASE_URL=https://api.deepseek.com/v1` 或 `USE_DEEPSEEK_LLM=1`。  
   - 不配读图时，用户必须在页面里**手动写**「风格与细节说明」。

   保存后 Railway 通常会**自动重新部署**。

2. **公网访问地址（可分享的 https 链接）**  
   在服务里打开 **Settings** → **Networking**（或 **Generate Domain** / 「生成域名」），为 Web 服务**启用公开域名**。  
   生成后会得到形如 **`https://xxxx.up.railway.app`** 的地址，**这就是给别人用的链接**。  
   若部署完打不开，多半是还没生成域名，或部署失败（看 **Deployments** 里的日志）。

3. **自检**  
   浏览器访问：**你的域名 `/api/health`**。  
   - `imageConfigured` 应为 **`true`**，且 `imageProvider` 为 **`replicate`** 或 **`seedream`**（与你配置一致）。  
   - 若用了读图，`llmConfigured` 应为 **`true`**。  
   再回到首页即可上传测试。

> Railway 按用量计费，请以 [Railway 定价说明](https://railway.app/pricing) 为准；测试阶段可关注控制台用量。

### 方式 B：Docker 部署到任意云平台

仓库根目录包含 **`Dockerfile`**。在支持容器的平台（如部分国内云、Fly.io、AWS 等）构建镜像并映射 **`PORT`** 环境变量即可。

### 方式 C：临时链接（本机开着服务时给别人试一下）

不永久托管，仅在你电脑运行 `npm start` 期间有效：

1. 安装 [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)，或使用自带的 `npx`（需联网下载）：  
   `npx cloudflared tunnel --url http://127.0.0.1:8787`  
2. 终端里会出现 **`https://xxxx.trycloudflare.com`**，复制即可分享。  
3. 关闭终端或服务后链接失效。

---

本地 **`127.0.0.1`** 本身不能被互联网上其他人打开；可分享链接必须来自 **云平台域名** 或 **隧道服务**。

## 项目结构

```
├── public/           # 静态页面（HTML / CSS / JS）
│   ├── index.html    # 上传与结果展示页
│   ├── styles.css    # 样式
│   └── app.js        # 前端交互
├── server.mjs        # Express + multer + Replicate 调用
├── render.yaml       # Render 一键部署描述（可选）
├── Dockerfile        # 容器部署（可选）
├── Procfile          # 部分平台进程声明（可选）
├── package.json
├── .env.example      # 环境变量示例
└── README.md         # 本说明
```

## 费用与合规

- Replicate、OpenAI 均为按量计费，请以各自控制台账单为准。  
- 请确保您对上传图片拥有使用权；生成结果仅供个人决策参考，不构成设计或施工承诺。

## 后续可改进方向

- 接入国内多模态模型，降低跨境访问与汇率成本。  
- 增加「房间类型」「强度滑杆」等参数，便于控制改动幅度。  
- 对实拍图做线段/深度估计的双控件生成（需对接支持 ControlNet 的模型），进一步锁结构。

如需我根据你的户型照片类型（客厅/卧室/厨卫）定制默认提示词或界面文案，可以直接说明使用场景。

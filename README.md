# 装修落地效果预览

面向非技术用户的轻量网页：**上传房屋实拍图** + **上传参考效果图**，由后端调用 AI 将「效果意向」迁移到实拍照片上，帮助快速判断装修风格是否贴近预期。

## 功能说明

| 步骤 | 说明 |
|------|------|
| 上传实拍图 | 您家里的现状照片，尽量与效果图视角接近。 |
| 上传效果图 | 喜欢的设计参考（网络图、设计师稿均可）。 |
| 生成预览 | 服务器调用 **Replicate** 上的 **FLUX.1 Kontext [max]**，以实拍图为底图做「可按文字指令编辑」的生成。 |

## 如何尽量满足「不改格局、保留光线」

纯软件无法像测量仪器一样保证毫米级不变，本项目通过两层手段**约束模型倾向**：

1. **提示词硬约束**：在服务端拼接英文指令，要求保留墙体/洞口/相机视角，并尽量保留原图光照与曝光。
2. **效果图语义**：若配置了 **OpenAI API**，会先用 `gpt-4o-mini` **阅读效果图**并生成简短英文材质/配色描述，再与您在表单里写的中文说明合并，交给 Kontext，减少「只 upload 一张图却说不清要什么」的情况。

> **说明**：当前管线没有直接把两张图同时「像素对齐」融合进单一扩散模型；效果图通过「文字描述」间接影响生成。若自动描述不理想，请务必备注框里写清需求。

## 环境要求

- [Node.js](https://nodejs.org/) 18 或以上  
- 可访问互联网的机器（需调用 Replicate，可选 OpenAI）

## 快速开始

1. **安装依赖**（在项目根目录执行）：

   ```bash
   npm install
   ```

2. **配置密钥**：复制 `.env.example` 为 `.env`，填入 `REPLICATE_API_TOKEN`（必填）。  
   - 获取地址：<https://replicate.com/account/api-tokens>  
   - 可选：填入 `OPENAI_API_KEY`，用于从效果图自动生成英文描述（<https://platform.openai.com/api-keys>）。

3. **启动服务**：

   ```bash
   npm start
   ```

4. 浏览器打开：**http://127.0.0.1:8787**（端口可通过环境变量 `PORT` 修改）。

## 如何得到「可分享的链接」（HTTPS）

我本人无法替你在云端开户并生成真实域名；链接会在你完成下面任一方式后，由平台自动给出。

### 方式 A：部署到 Render（推荐，免费 HTTPS）

适合长期使用：得到一个形如 **`https://zhuangxiu-effect-preview.onrender.com`** 的地址（名称可在控制台修改）。

1. 把本项目推到 **GitHub / GitLab** 私有或公开仓库均可。  
2. 打开 [Render](https://render.com/)，注册并连接仓库。  
3. 选择 **New → Blueprint**，选中仓库；Render 会读取根目录的 **`render.yaml`**。  
4. 在控制台为 **`REPLICATE_API_TOKEN`**（必填）和可选的 **`OPENAI_API_KEY`** 填入密钥（勾选 Secret）。  
5. 部署完成后，在服务的 **URL** 一栏复制链接发给他人即可。

> 免费实例在无访问时会休眠，首次打开可能需要几十秒唤醒。

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

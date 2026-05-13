# AI 装修效果预览

上传「房屋实拍图」和「设计效果图」，利用 AI 将效果图的设计风格应用到实拍图上，以辅助装修决策。

本项目采用先进的 `ControlNet` 技术，可以精准地保持原始房间的布局、结构和透视关系不变，仅对材质、颜色和软装风格进行替换，从而生成高度可信的预览图。

## 核心技术栈

- **前端**: 原生 HTML, CSS, JavaScript
- **后端**: Node.js + Express
- **AI 语义理解**: [DeepSeek-VL](https://platform.deepseek.com/) (用于从效果图分析房间类型和风格关键词)
- **AI 图像生成**: [Replicate](https://replicate.com/) 平台托管的 `ControlNet` 模型 (`rocketdigitalai/interior-design-sdxl`)

## 环境要求

- [Node.js](https://nodejs.org/) 18 或以上
- 可访问互联网的机器 (需要调用 Replicate 和 DeepSeek 的 API)

## 快速开始

1. **克隆或下载项目到本地。**

2. **安装依赖** (在项目根目录执行)：
   ```bash
   npm install
   ```

3. **配置密钥**：
   - 复制项目根目录下的 `.env.example` 文件，并重命名为 `.env`。
   - 打开 `.env` 文件，填入以下两个密钥：

     | 环境变量 | 用途 | 获取地址 |
     | :--- | :--- | :--- |
     | `REPLICATE_API_TOKEN` | **必需**。用于调用 ControlNet 图像生成模型。 | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |
     | `DEEPSEEK_API_KEY` | **强烈推荐**。用于 AI 自动分析效果图，大幅提升效果。 | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |

4. **启动服务**：
   ```bash
   npm start
   ```

5. **浏览器打开**：访问 **http://127.0.0.1:8787** (端口可通过环境变量 `PORT` 修改)。

> **重要提示**: 每次修改 `.env` 文件后，都必须在终端按 `Ctrl + C` 停止服务，然后重新运行 `npm start`，配置才会生效。

## 功能原理

1.  **语义理解**: 用户上传“意向图”后，后端会调用 **DeepSeek-VL** 模型分析该图片，以 JSON 格式返回其“房间类型”和“风格关键词”。
2.  **指令生成**: 后端将 AI 分析出的关键词与用户在文本框中输入的说明合并，形成最终的风格指令 (Prompt)。
3.  **可控生成**: 后端调用 **Replicate** 上的 `ControlNet` 模型，将“实拍图”作为空间结构参考，将风格指令作为内容参考，生成一张既保留了原始房间结构、又应用了新风格的效果图。

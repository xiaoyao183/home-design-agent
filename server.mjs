/**
 * 上传实拍图 + 效果图 → 调用图像模型生成预览。
 * 图像后端：Replicate（Flux Kontext）或火山方舟 Seedream（Doubao）。
 * 可选：多模态大模型从效果图生成文字描述（OpenAI / DeepSeek 兼容接口）。
 */
import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import Replicate from "replicate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
/** 部署在 Render / Railway 等反向代理后，便于正确识别 HTTPS 与客户端 IP */
app.set("trust proxy", 1);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** 解析使用的图像后端：replicate | seedream */
function resolveImageProvider() {
  const explicit = (process.env.IMAGE_PROVIDER || "").toLowerCase().trim();
  if (explicit === "replicate" || explicit === "seedream") return explicit;
  if (process.env.SEEDREAM_API_KEY) return "seedream";
  if (process.env.REPLICATE_API_TOKEN) return "replicate";
  return null;
}

const imageProvider = resolveImageProvider();

const replicate =
  imageProvider === "replicate" && process.env.REPLICATE_API_TOKEN
    ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
    : null;

app.use(express.static(path.join(__dirname, "public")));

/** Seedream（火山方舟）默认接口与模型，可在环境变量中覆盖 */
const SEEDREAM_DEFAULT_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const SEEDREAM_DEFAULT_MODEL = "doubao-seedream-5-0-260128";

/** 健康检查 */
app.get("/api/health", (_req, res) => {
  const provider = imageProvider;
  let imageConfigured = false;
  if (provider === "replicate") imageConfigured = Boolean(process.env.REPLICATE_API_TOKEN);
  else if (provider === "seedream") imageConfigured = Boolean(seedreamApiKey());

  const llm = getLlmVisionConfig();

  res.json({
    ok: true,
    imageProvider: provider || "none",
    imageConfigured,
    llmProvider: llm?.provider || "none",
    llmConfigured: Boolean(llm?.apiKey),
    /** @deprecated 兼容旧前端字段名 */
    replicateConfigured: provider === "replicate" && Boolean(process.env.REPLICATE_API_TOKEN),
    /** @deprecated 兼容旧前端字段名 */
    openaiConfigured: Boolean(llm?.apiKey),
  });
});

/** 读取 Seedream API Key：专用变量优先，其次兼容误写在 REPLICATE_API_TOKEN 的情况 */
function seedreamApiKey() {
  return process.env.SEEDREAM_API_KEY || process.env.REPLICATE_API_TOKEN || "";
}

/**
 * 多模态「读效果图」配置：支持 OpenAI 官方与 DeepSeek（OpenAI 兼容 Chat Completions）。
 */
function getLlmVisionConfig() {
  const key = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;

  const explicit = (process.env.LLM_PROVIDER || "").toLowerCase().trim();
  const baseFromEnv = (process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || "").replace(/\/$/, "");

  if (explicit === "deepseek" || baseFromEnv.includes("deepseek.com") || process.env.USE_DEEPSEEK_LLM === "1") {
    const base = baseFromEnv || "https://api.deepseek.com/v1";
    return {
      provider: "deepseek",
      chatUrl: `${base}/chat/completions`,
      apiKey: key,
      model: process.env.LLM_VISION_MODEL || "deepseek-v4-flash",
    };
  }

  const base = baseFromEnv || "https://api.openai.com/v1";
  return {
    provider: "openai",
    chatUrl: `${base}/chat/completions`,
    apiKey: key,
    model: process.env.LLM_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

/**
 * 调用配置的 Chat Completions，从效果图生成英文材质/风格描述。
 */
async function describeEffectWithVision(effectBuffer, mimeType) {
  const cfg = getLlmVisionConfig();
  if (!cfg) return null;

  const b64 = effectBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${b64}`;

  const body = {
    model: cfg.model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              '你是一位专业的室内设计师。请分析这张室内设计效果图，并以JSON格式返回你的分析结果。' +
              'JSON对象必须包含以下两个键：' +
              '1. "room_type": 字符串，识别房间类型（例如："客厅", "卧室", "厨房", "卫生间"）。' +
              '2. "style_keywords": 字符串数组，提取5-8个最核心的设计要素、材质和风格关键词（例如：["木色柜子", "不锈钢金属拉手", "柚木色地板", "木色与金属材质", "阿尔托风格"])。' +
              '请确保返回的是一个格式良好、可以直接被解析的JSON对象，不要包含任何额外的解释或非JSON内容。',
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 400,
  };

  const r = await fetch(cfg.chatUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`多模态描述失败 (${cfg.provider}): ${r.status} ${t}`);
  }

  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content?.trim();
  if (!text) return null;

  try {
    // The model might return the JSON string inside a markdown code block
    const jsonString = text.replace(/```json\n?|\n?```/g, "");
    const parsed = JSON.parse(jsonString);
    if (parsed && parsed.room_type && Array.isArray(parsed.style_keywords)) {
        return parsed; // return the parsed object
    }
    console.warn("Vision model did not return the expected JSON format.", parsed);
    return null;
  } catch (e) {
    console.error("Failed to parse JSON from Vision model:", text);
    return null;
  }
}

/** 统一解析 Replicate 返回的图片 URL */
function normalizeImageUrl(output) {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first.url === "string") return first.url;
    if (first && typeof first.href === "string") return first.href;
  }
  if (typeof output === "object") {
    if (typeof output.url === "string") return output.url;
    if (typeof output.href === "string") return output.href;
  }
  return null;
}

/** 解析 Seedream / OpenAI 风格 images 接口返回 */
function parseSeedreamImageResponse(json) {
  const d0 = json?.data?.[0];
  if (!d0) return null;
  if (typeof d0.url === "string") return d0.url;
  if (typeof d0.b64_json === "string") return `data:image/png;base64,${d0.b64_json}`;
  return null;
}

/**
 * 火山方舟 Seedream：以实拍图为参考、按 prompt 出图（图生图/编辑类能力，依模型而定）。
 */
async function generateWithSeedream(prompt, actualBuffer, actualMime) {
  const apiKey = seedreamApiKey();
  if (!apiKey) throw new Error("未配置 SEEDREAM_API_KEY（或 Seedream 用的 REPLICATE_API_TOKEN）。");

  const url = process.env.SEEDREAM_API_URL || SEEDREAM_DEFAULT_URL;
  const model = process.env.SEEDREAM_MODEL || SEEDREAM_DEFAULT_MODEL;
  const size = process.env.SEEDREAM_SIZE || "2K";

  const dataUri = `data:${actualMime};base64,${actualBuffer.toString("base64")}`;

  const body = {
    model,
    prompt,
    image: [dataUri],
    size,
    response_format: "url",
    watermark: process.env.SEEDREAM_WATERMARK === "true",
    sequential_image_generation: "disabled",
  };

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Seedream 请求失败: ${r.status} ${text.slice(0, 500)}`);
  }

  if (!r.ok) {
    throw new Error(`Seedream API 错误: ${r.status} ${text.slice(0, 800)}`);
  }

  const imageUrl = parseSeedreamImageResponse(json);
  if (!imageUrl) {
    throw new Error(`Seedream 返回中未找到图片 URL，原始响应: ${text.slice(0, 600)}`);
  }
  return imageUrl;
}

function buildEditPrompt(styleDescription) {
  const desc = styleDescription?.trim() || "现代舒适的室内设计，色调和谐";
  return [
    "请根据以下设计意图编辑这张室内照片：",
    desc,
    "",
    "硬性约束:",
    "- 保持完全相同的房间布局：墙壁、洞口、窗户、门和相机视角。",
    "- 尽可能保留原始照片的光照方向、亮度、阴影和白平衡。",
    "- 不要改变透视、几何形状或房间形状。",
    "- 主要通过适合空间的材料、颜色、家具和装饰来应用变更。",
    "- 生成适合装修预览的逼真照片效果。",
  ].join("\n");
}

/**
 * POST multipart: fields actual (file), effect (file), notes (optional text)
 */
app.post("/api/generate", upload.fields([{ name: "actual", maxCount: 1 }, { name: "effect", maxCount: 1 }]), async (req, res) => {
  try {
    if (!imageProvider) {
      return res.status(503).json({
        error:
          "未配置图像后端。请设置 IMAGE_PROVIDER=replicate 或 seedream，并配置对应 API（见 README / .env.example）。",
      });
    }

    if (imageProvider === "replicate" && !replicate) {
      return res.status(503).json({ error: "已选择 Replicate，但未配置有效的 REPLICATE_API_TOKEN。" });
    }

    if (imageProvider === "seedream" && !seedreamApiKey()) {
      return res.status(503).json({
        error: "已选择 Seedream，但未配置 SEEDREAM_API_KEY（或将密钥写在 REPLICATE_API_TOKEN 供 Seedream 使用）。",
      });
    }

    const actualFile = req.files?.actual?.[0];
    const effectFile = req.files?.effect?.[0];
    if (!actualFile || !effectFile) {
      return res.status(400).json({ error: "请同时上传实拍图（actual）与效果图（effect）。" });
    }

    const notes = (req.body?.notes || "").trim();

    let styleDescription = notes;
    let autoDescribed = false;
    const llm = getLlmVisionConfig();
    if (llm) {
      try {
        const mime = effectFile.mimetype || "image/jpeg";
        const aiDescObject = await describeEffectWithVision(effectFile.buffer, mime);
        if (aiDescObject) {
          autoDescribed = true;
          const keywords = aiDescObject.style_keywords.join(", ");
          const room = aiDescObject.room_type;
          const aiDesc = `AI分析效果图：房间是${room}，风格特点是${keywords}。`;
          styleDescription = [notes, aiDesc].filter(Boolean).join("\n\n");
        }
      } catch (err) {
        console.warn("多模态读效果图失败，将仅使用用户填写说明:", err.message);
      }
    }

    if (!styleDescription.trim()) {
      return res.status(400).json({
        error:
          "请填写「风格与细节说明」，或配置 LLM（OPENAI_API_KEY / DEEPSEEK_API_KEY + LLM_PROVIDER）以便从效果图自动生成描述。",
      });
    }

    const actualMime = actualFile.mimetype || "image/jpeg";
    let imageUrl;
    let promptUsed;

    if (imageProvider === "replicate") {
      promptUsed = styleDescription;
      const actualDataUri = `data:${actualMime};base64,${actualFile.buffer.toString("base64")}`;
      const output = await replicate.run(
        "lucataco/sdxl-controlnet-depth:5e0a5cda895aa23a1aaa1a9a265220097102448e1b4c42b22a3c6d87c12d41a9",
        {
          input: {
            image: actualDataUri,
            prompt: promptUsed,
            condition_scale: 0.7, // Add a reasonable default for controlnet strength
          },
        }
      );
      imageUrl = normalizeImageUrl(output);
      if (!imageUrl) {
        return res.status(500).json({ error: "模型未返回有效图片地址。", raw: output });
      }
    } else {
      promptUsed = buildEditPrompt(styleDescription);
      imageUrl = await generateWithSeedream(promptUsed, actualFile.buffer, actualMime);
    }

    return res.json({
      imageUrl,
      promptUsed: promptUsed,
      autoDescribed,
      imageBackend: imageProvider,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(
    `装修预览服务已启动：本机 http://127.0.0.1:${PORT} · 监听 ${HOST}:${PORT} · 图像后端=${imageProvider || "未配置"}`
  );
});

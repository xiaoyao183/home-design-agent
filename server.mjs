/**
 * 本地 API 服务：上传实拍图、效果图，调用 Replicate（Flux Kontext）生成「保格局、尽量保光线」的预览图。
 * 可选 OpenAI 视觉：从效果图自动生成英文描述，便于 Kontext 遵循。
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

const replicate = process.env.REPLICATE_API_TOKEN
  ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  : null;

app.use(express.static(path.join(__dirname, "public")));

/** 健康检查：是否已配置 Replicate */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    replicateConfigured: Boolean(process.env.REPLICATE_API_TOKEN),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
});

/**
 * 使用 OpenAI 多模态模型，从效果图生成简短英文描述（供 Kontext 使用）。
 */
async function describeEffectWithOpenAI(effectBuffer, mimeType) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const b64 = effectBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${b64}`;

  const body = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Describe this interior design reference image in English only. " +
              "Focus on: wall colors/materials, flooring, ceiling, furniture style, " +
              "decor, lighting fixtures. 4–6 short sentences. No people; no camera talk.",
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 400,
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI 描述失败: ${r.status} ${t}`);
  }

  const j = await r.json();
  const text = j?.choices?.[0]?.message?.content?.trim();
  return text || null;
}

/**
 * 拼装 Kontext 提示：强调不改动格局与原始光线。
 */
/** 统一解析 Replicate 返回的图片 URL（字符串、数组或带 url 字段的对象） */
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

function buildKontextPrompt(styleDescription) {
  const desc = styleDescription?.trim() || "modern cozy interior with cohesive palette";
  return [
    "Edit this interior photograph to match the following design intent:",
    desc,
    "",
    "Hard constraints:",
    "- Keep the exact same room layout: walls, openings, windows, doors, and camera viewpoint.",
    "- Preserve the original photo lighting direction, brightness, shadows, and white balance as much as possible.",
    "- Do not change perspective, geometry, or room shape.",
    "- Apply changes mainly through materials, colors, furniture, and decor that fit the space.",
    "- Photorealistic output suitable for renovation preview.",
  ].join("\n");
}

/**
 * POST multipart: fields actual (file), effect (file), notes (optional text, 用户补充说明)
 */
app.post("/api/generate", upload.fields([{ name: "actual", maxCount: 1 }, { name: "effect", maxCount: 1 }]), async (req, res) => {
  try {
    if (!replicate) {
      return res.status(503).json({ error: "未配置 REPLICATE_API_TOKEN，请在项目根目录创建 .env 并参阅 README。" });
    }

    const actualFile = req.files?.actual?.[0];
    const effectFile = req.files?.effect?.[0];
    if (!actualFile || !effectFile) {
      return res.status(400).json({ error: "请同时上传实拍图（actual）与效果图（effect）。" });
    }

    const notes = (req.body?.notes || "").trim();

    let styleDescription = notes;
    let autoDescribed = false;
    if (process.env.OPENAI_API_KEY) {
      try {
        const mime = effectFile.mimetype || "image/jpeg";
        const aiDesc = await describeEffectWithOpenAI(effectFile.buffer, mime);
        if (aiDesc) {
          autoDescribed = true;
          styleDescription = [notes, aiDesc].filter(Boolean).join("\n\n");
        }
      } catch (err) {
        console.warn("OpenAI 效果图描述失败，将仅使用用户填写说明:", err.message);
      }
    }

    if (!styleDescription.trim()) {
      return res.status(400).json({
        error:
          "请填写「风格与细节说明」，或配置 OPENAI_API_KEY 以便系统从效果图自动生成描述。",
      });
    }

    const prompt = buildKontextPrompt(styleDescription);

    // Replicate 接受 data URI 作为部分模型的文件输入
    const actualMime = actualFile.mimetype || "image/jpeg";
    const actualDataUri = `data:${actualMime};base64,${actualFile.buffer.toString("base64")}`;

    const output = await replicate.run("black-forest-labs/flux-kontext-max", {
      input: {
        input_image: actualDataUri,
        prompt,
        aspect_ratio: "match_input_image",
        output_format: "png",
        safety_tolerance: 2,
      },
    });

    const imageUrl = normalizeImageUrl(output);
    if (!imageUrl) {
      return res.status(500).json({ error: "模型未返回有效图片地址。", raw: output });
    }

    return res.json({
      imageUrl,
      promptUsed: prompt,
      autoDescribed,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

const PORT = Number(process.env.PORT) || 8787;
/** 0.0.0.0：云主机需监听所有网卡，否则外网无法访问 */
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`装修预览服务已启动：本机 http://127.0.0.1:${PORT} · 监听 ${HOST}:${PORT}`);
});

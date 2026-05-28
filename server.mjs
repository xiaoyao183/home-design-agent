/**
 * 上传实拍图 + 效果图 → 调用图像模型生成预览。
 * 图像后端：Replicate（Flux Kontext）、火山方舟 Seedream（Doubao）或 OpenAI（gpt-image-2）。
 * 可选：多模态大模型从效果图生成文字描述（OpenAI / DeepSeek 兼容接口）。
 * OpenAI Image 支持 LoRA 进行风格控制。
 */
import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import Replicate from "replicate";

// --- 风格库数据 ---
const styleLibrary = [
  {
    id: "bauhaus",
    name: "包豪斯",
    description: "强调功能性、简洁性和几何形式，通常使用原色和中性色。",
    image: "/images/cover_baohaosi.jpg",
    history: "包豪斯（Bauhaus）是20世纪初德国的一所艺术与建筑学校，它开创了现代主义设计的先河。其核心理念是“艺术与技术的新统一”，致力于将手工艺与工业生产相结合，创造出既美观又实用的产品。尽管学校只存在了14年，但其激进的教育理念和设计原则深刻影响了全球的建筑、设计和艺术领域，至今仍是现代设计的基石。",
    gallery: ["/images/bauhaus-1.jpg", "/images/bauhaus-2.jpg", "/images/bauhaus-3.jpg"],
    keywords: ["包豪斯风格", "几何形状", "功能主义", "钢管家具", "原色", "简洁线条"],
    /** 风格灵感 · gpt-image-2 专用完整提示词 */
    generatePrompt: `请基于用户上传的户型图，生成一张建筑事务所级别的室内设计提案板。

提案板包含三个部分：

1、顶部为整体空间主效果图
2、中部为家具拆解图，并带有文字说明
3、底部为材料拆解图，展示材料样板与名称

整体空间风格：
包豪斯风格室内设计，强调功能主义与几何秩序，现代主义建筑语言，简洁克制，极少装饰，黑白灰主色调，局部红色点缀，强烈的水平与垂直线条，几何构成感，现代艺术气质，高级建筑空间氛围

家具设计：
包豪斯经典家具设计，钢管结构家具，瓦西里椅风格，黑色烤漆餐桌，几何边柜，现代线性吊灯，模块化家具，极简造型，强调结构美感与工业感

材料系统：
微水泥地面，黑色木饰面，哑光烤漆，不锈钢金属，玻璃材质，亚麻布艺，皮革纹理，低饱和材料体系，现代高级材料质感

渲染风格：
超写实室内效果图，自然柔和日光，大面积落地窗，真实光影，电影级空间氛围，高级建筑可视化效果，细节丰富，材质真实，干净纯粹的空间摄影风格

版式设计：
建筑事务所级别的提案板设计，瑞士平面风格，现代杂志排版，极简构图，统一字体系统，留白高级，信息层级清晰

要求：
保留户型原始空间结构与窗户位置，空间比例真实合理。

避免：
欧式、古典、复杂装饰、暖黄色灯光、杂乱摆件、低级家装感、低清晰度、错误透视`,
  },
  {
    id: "aalto",
    name: "阿尔瓦·阿尔托",
    description: "有机形式、自然材料（尤其是弯曲木材）和对人性的关注是其核心。",
    image: "/images/cover_aertuo.jpg",
    history: "阿尔瓦·阿尔托（Alvar Aalto）是芬兰现代主义建筑的巨匠。他反对纯粹理性的国际主义风格，倡导“人性化的功能主义”。他从芬兰的自然风光中汲取灵感，广泛使用木材、砖等自然材料，并通过对光线和空间的巧妙处理，创造出充满温情和人文关怀的建筑环境。他的设计涵盖建筑、家具、玻璃器皿等多个领域，对后世设计产生了深远影响。",
    gallery: ["/images/aalto-1.jpg", "/images/aalto-2.jpg", "/images/aalto-3.jpg"],
    keywords: ["阿尔瓦·阿尔托风格", "有机现代主义", "弯曲胶合板", "自然光", "与自然融合", "芬兰设计"],
     /** 风格灵感 · gpt-image-2 专用完整提示词 */
     generatePrompt: `请基于用户上传的图片，生成一张建筑事务所级别的室内设计提案板。

     提案板包含三个部分：
     
     1、顶部为整体空间主效果图
     2、中部为家具拆解图，并带有文字说明
     3、底部为材料拆解图，展示材料样板与名称
     
     整体空间风格：
     阿尔托风格室内设计，受到芬兰现代主义建筑影响，强调自然、人文与有机功能主义。
     
     空间气质：
     温暖、安静、柔和，避免冰冷工业感。

      采用：

      蜂蜜色桦木、海洋板木材、
      弧形家具、
      自然曲线、
      温润木饰面、
      奶油白墙面、
      亚麻布艺、
      磨砂玻璃、
      柔和漫反射光线。

      空间强调：

      自然采光、
      人与空间的舒适关系、
      有机形态、
      现代主义中的温暖感。

      家具具有北欧现代主义气质，
      线条克制但富有柔和曲线，
      避免尖锐几何与强烈工业感。

      整体氛围像：

      芬兰湖畔住宅、
      现代艺术家的家、
      高端北欧建筑空间、
      安静而高级的现代住宅。

      空间配色比例：

      70% 蜂蜜或者柚木木色与暖白色
      20% 浅灰与亚麻色
      10% 黑色细节与蓝色艺术点缀

      自然光柔和，
      空间安静通透，
      具有高级建筑摄影质感。
     
     渲染风格：
     超写实室内效果图，自然柔和日光，大面积落地窗，真实光影，电影级空间氛围，高级建筑可视化效果，细节丰富，材质真实，干净纯粹的空间摄影风格
     
     版式设计：
     建筑事务所级别的提案板设计，瑞士平面风格，现代杂志排版，极简构图，统一字体系统，留白高级，信息层级清晰
     
     要求：
     保留户型原始空间结构与窗户位置，空间比例真实合理。
     
     避免：
     欧式、古典、复杂装饰、暖黄色灯光、杂乱摆件、低级家装感、低清晰度、错误透视`,
  },
  {
    id: "japandi",
    name: "日式侘寂",
    description: "结合了日本的侘寂美学和斯堪的纳维亚的简约，注重不完美、自然和宁静。",
    image: "/images/cover_rishi.jpg",
    history: "日式侘寂（Japandi）并非源自单一的历史人物或运动，而是两种美学的融合：日本的“Wabi-Sabi”（侘寂）和斯堪的纳维亚的“Hygge”（舒适）。它兴起于近年，反映了人们对宁静、自然和简约生活的向往。这种风格吸收了东方禅意中的不完美和顺应自然，又结合了北欧设计中的功能主义和舒适感，创造出一种既简约又温暖的现代家居氛围。",
    gallery: ["/images/japandi-1.jpg", "/images/japandi-2.jpg", "/images/japandi-3.jpg"],
    keywords: ["日式侘寂", "自然材质", "中性色调", "极简主义", "不完美的完美", "手工感"],
     /** 风格灵感 · gpt-image-2 专用完整提示词 */
     generatePrompt: `请基于用户上传的图片，生成一张建筑事务所级别的室内设计提案板。

     提案板包含三个部分：
     
     1、顶部为整体空间主效果图
     2、中部为家具拆解图，并带有文字说明
     3、底部为材料拆解图，展示材料样板与名称
     
     整体空间风格：
     日式侘寂风格室内设计，强调不完美、自然感、时间痕迹与安静氛围。
     
     空间气质：
     克制、空灵、宁静，避免精致奢华与过度设计。

      采用：

      原木、
      微水泥、
      夯土墙、
      天然石材、
      亚麻、
      藤编、
      和纸、
      手工陶器、
      自然肌理材料。

      空间强调：

      留白、
      低饱和色彩、
      自然老化痕迹、
      柔和阴影、
      人与自然的关系。

      家具低矮简洁，
      造型极简，
      强调材质本身的纹理与触感。

      整体氛围像：

      京都现代民宿、
      山间温泉住宅、
      禅意茶室、
      现代东方建筑空间。

      空间配色比例：

      60% 米白与泥土色
      30% 原木与天然材料
      10% 深色木质与石材点缀

      自然光从侧面缓慢进入空间，
      光影柔和，
      具有安静而深层的情绪感。

     
     渲染风格：
     超写实室内效果图，自然柔和日光，大面积落地窗，真实光影，电影级空间氛围，高级建筑可视化效果，细节丰富，材质真实，干净纯粹的空间摄影风格
     
     版式设计：
     建筑事务所级别的提案板设计，瑞士平面风格，现代杂志排版，极简构图，统一字体系统，留白高级，信息层级清晰
     
     要求：
     保留户型原始空间结构与窗户位置，空间比例真实合理。
     
     避免：
     现代轻奢、过度日式网红感、复杂装饰、过亮灯光、塑料材质、商业样板间气质、低清晰度、错误透视。`,
  },
  {
    id: "mid-century",
    name: "中古现代",
    description: "20世纪中叶的设计风格，特点是简洁的线条、有机的形状和对不同材料的探索。",
    image: "/images/cover_zhonggu.jpg",
    history: "中古现代（Mid-Century Modern）风格主要流行于二战后的1945年至1969年间。这是一个充满乐观主义和技术创新的时代，设计师们渴望摆脱传统束缚，拥抱新的材料和生产方式（如塑料、胶合板）。该风格深受包豪斯和国际主义的影响，但更具趣味性和有机的形态。它强调功能性、简洁的线条和与自然的连接，创造了许多至今仍在生产的经典家具作品。",
    gallery: ["/images/mid-century-1.jpg", "/images/mid-century-2.jpg", "/images/mid-century-3.jpg"],
    keywords: ["中古现代风格", "柚木家具", "简洁线条", "有机曲线", "复古色调", "黄铜元素"],
     /** 风格灵感 · gpt-image-2 专用完整提示词 */
     generatePrompt: `请基于用户上传的图片，生成一张建筑事务所级别的室内设计提案板。

     提案板包含三个部分：
     
     1、顶部为整体空间主效果图
     2、中部为家具拆解图，并带有文字说明
     3、底部为材料拆解图，展示材料样板与名称
     
     整体空间风格：
     中古现代风格室内设计，受到20世纪中期现代主义影响，强调功能、美学与轻松生活方式。
     
     空间气质：
     复古但现代，具有艺术感与居住温度。

      采用：

      胡桃木、
      柚木、
      皮革、
      黄铜、
      羊毛织物、
      低饱和复古配色、
      几何图案、
      温暖木质纹理。

      家具强调：

      细腿家具、
      经典现代主义比例、
      有机曲线、
      低重心沙发、
      复古单椅、
      现代主义灯具。

      空间整体具有：

      1950s-1970s现代住宅气质、
      艺术收藏感、
      轻复古氛围、
      高级生活感。

      空间配色比例：

      50% 暖木色
      30% 奶油白与暖灰
      20% 墨绿、焦糖色、橄榄绿、复古橙色点缀

      自然光温暖柔和，
      空间舒适松弛，
      具有建筑摄影与电影场景感。
     
     渲染风格：
     超写实室内效果图，自然柔和日光，大面积落地窗，真实光影，电影级空间氛围，高级建筑可视化效果，细节丰富，材质真实，干净纯粹的空间摄影风格
     
     版式设计：
     建筑事务所级别的提案板设计，瑞士平面风格，现代杂志排版，极简构图，统一字体系统，留白高级，信息层级清晰
     
     要求：
     保留户型原始空间结构与窗户位置，空间比例真实合理。
     
     避免：
     过度复古、美式乡村、复杂雕花、老旧感、厚重深色空间、低清晰度、错误透视。`,
  },
  {
    id: "french-country",
    name: "法式乡村",
    description: "优雅与质朴的结合，常用柔和的色彩、复古家具和天然面料。",
    image: "/images/cover_fashi.jpg",
    history: "法式乡村（French Country）风格起源于法国南部的普罗旺斯地区。它的形成深受当地田园生活的影响，融合了宫廷的优雅与乡村的质朴。这种风格在18世纪开始成形，人们将路易十五时期优雅的家具线条简化，并使用当地的天然材料（如石头、木材）和柔和的色彩。它营造的是一种悠闲、舒适、浪漫且不失优雅的田园生活气息。",
    gallery: ["/images/french-country-1.jpg", "/images/french-country-2.jpg", "/images/french-country-3.jpg"],
    keywords: ["法式乡村风格", "优雅曲线", "做旧家具", "亚麻布艺", "柔和色调", "石膏线"],
     /** 风格灵感 · gpt-image-2 专用完整提示词 */
     generatePrompt: `请基于用户上传的图片，生成一张建筑事务所级别的室内设计提案板。

     提案板包含三个部分：
     
     1、顶部为整体空间主效果图
     2、中部为家具拆解图，并带有文字说明
     3、底部为材料拆解图，展示材料样板与名称
     
     整体空间风格：
     法式乡村风格室内设计，融合南法乡村住宅与现代法式审美。
     
     空间气质：
     自然、浪漫、轻松，避免厚重宫廷感与过度复古。

      采用：

      奶油白墙面、
      浅色橡木、
      天然石材、
      亚麻布艺、
      复古陶器、
      法式木家具、
      做旧金属、
      柔和织物纹理。

      空间强调：

      自然生活感、
      阳光感、
      法式松弛氛围、
      轻微复古感、
      舒适与优雅并存。

      家具比例优雅轻盈，
      具有法式传统细节，
      但整体保持现代克制。

      整体氛围像：

      法国乡村别墅、
      普罗旺斯住宅、
      现代法式度假屋、
      高端生活方式空间。

      空间配色比例：

      60% 奶油白与浅米色
      25% 浅木色与天然石材
      15% 亚麻灰、鼠尾草绿与陶土色点缀

      阳光温暖柔和，
      空间自然松弛，
      具有高级杂志摄影感。
     
     渲染风格：
     超写实室内效果图，自然柔和日光，大面积落地窗，真实光影，电影级空间氛围，高级建筑可视化效果，细节丰富，材质真实，干净纯粹的空间摄影风格
     
     版式设计：
     建筑事务所级别的提案板设计，瑞士平面风格，现代杂志排版，极简构图，统一字体系统，留白高级，信息层级清晰
     
     要求：
     保留户型原始空间结构与窗户位置，空间比例真实合理。
     
     避免：
     宫廷法式、重度雕花、金色奢华感、欧式酒店感、复杂吊顶、低清晰度、错误透视`,
  },
  {
    id: "modern-minimalist",
    name: "现代简约",
    description: "“少即是多”，通过极致的简洁、开放的空间和精确的线条来表达。",
    image: "/images/cover_xiandai.jpg",
    history: "现代简约主义（Modern Minimalist）的根源可以追溯到20世纪初的现代主义运动，特别是荷兰的“风格派”（De Stijl）和德国的包豪斯。它在20世纪下半叶得到充分发展，是对过度装饰的维多利亚风格和消费主义社会的一种反思。其哲学核心“少即是多”（Less is more）由建筑师密斯·凡·德·罗提出，强调通过极致的简洁、中性的色彩和对材料本质的尊重，来创造纯粹、宁静和高度功能化的空间。",
    gallery: ["/images/modern-minimalist-1.jpg", "/images/modern-minimalist-2.jpg", "/images/modern-minimalist-3.jpg"],
    keywords: ["现代简约风格", "黑白灰", "极简线条", "隐藏式收纳", "开放空间", "无主灯设计"],
     /** 风格灵感 · gpt-image-2 专用完整提示词 */
     generatePrompt: `请基于用户上传的图片，生成一张建筑事务所级别的室内设计提案板。

     提案板包含三个部分：
     
     1、顶部为整体空间主效果图
     2、中部为家具拆解图，并带有文字说明
     3、底部为材料拆解图，展示材料样板与名称
     
     整体空间风格：
     现代简约风格室内设计，强调极简主义、空间秩序与高级材料质感。
     
     空间气质：
     干净克制，避免廉价样板间与冰冷极简风。

      采用：

      微水泥、
      浅灰石材、
      木饰面、
      哑光金属、
      大面积留白、
      隐藏式收纳、
      简洁线条。

      空间强调：

      比例关系、
      光影层次、
      材质细节、
      空间呼吸感、
      现代建筑气质。

      家具造型简洁，
      强调体块关系与低视觉噪音，
      避免复杂装饰。

      整体氛围像：

      现代建筑事务所住宅、
      高端极简公寓、
      现代艺术住宅、
      建筑摄影空间。

      空间配色比例：

      70% 白色、浅灰与暖灰
      20% 原木与石材
      10% 黑色线条与艺术品点缀

      自然光柔和均匀，
      空间安静纯净，
      具有高级建筑可视化效果。
     
     渲染风格：
     超写实室内效果图，自然柔和日光，大面积落地窗，真实光影，电影级空间氛围，高级建筑可视化效果，细节丰富，材质真实，干净纯粹的空间摄影风格
     
     版式设计：
     建筑事务所级别的提案板设计，瑞士平面风格，现代杂志排版，极简构图，统一字体系统，留白高级，信息层级清晰
     
     要求：
     保留户型原始空间结构与窗户位置，空间比例真实合理。
     
     避免：
     廉价现代风、复杂背景墙、网红家装感、强烈灯带、过度科技感、冰冷医院感。`,
  },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
/** 部署在 Render / Railway 等反向代理后，便于正确识别 HTTPS 与客户端 IP */
app.set("trust proxy", 1);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** 解析使用的图像后端：replicate | seedream | openai */
function resolveImageProvider() {
  const explicit = (process.env.IMAGE_PROVIDER || "").toLowerCase().trim();
  if (explicit === "replicate" || explicit === "seedream" || explicit === "openai") return explicit;
  if (process.env.OPENAI_API_KEY) return "openai";
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
  else if (provider === "openai") imageConfigured = Boolean(process.env.OPENAI_API_KEY);

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
    openaiConfigured: Boolean(llm?.apiKey) || Boolean(process.env.OPENAI_API_KEY),
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

/** 从 apimart 任务查询响应中解析图片 URL（result.images[0].url[0]） */
function extractApimartImageUrl(taskData) {
  if (!taskData) return null;
  const images = taskData?.result?.images;
  if (Array.isArray(images) && images.length > 0) {
    const urlField = images[0]?.url;
    if (Array.isArray(urlField) && typeof urlField[0] === "string") return urlField[0];
    if (typeof urlField === "string") return urlField;
  }
  if (typeof taskData.url === "string") return taskData.url;
  if (typeof taskData.image_url === "string") return taskData.image_url;
  if (typeof taskData?.result?.url === "string") return taskData.result.url;
  return null;
}

/** 组装 apimart gpt-image-2 请求体中的 size / resolution */
function buildApimartImageBodyFields() {
  const size = process.env.OPENAI_IMAGE_SIZE || "3:4";
  const fields = { size, n: 1 };
  if (size.includes(":") && !size.includes("x")) {
    fields.resolution = (process.env.OPENAI_IMAGE_RESOLUTION || "1k").toLowerCase();
  }
  return fields;
}

/**
 * OpenAI Image Generation：使用 gpt-image-2 模型进行图像编辑/生成。
 * 支持通过 LoRA 实现风格控制（需在 OpenAI 平台上传 LoRA 并指定名称）。
 */
async function generateWithOpenAI(prompt, actualBuffer, actualMime, styleLora = null) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("未配置 OPENAI_API_KEY。");

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.apimart.ai/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

  const dataUri = `data:${actualMime};base64,${actualBuffer.toString("base64")}`;

  const body = {
    model,
    prompt,
    image_urls: [dataUri],
    ...buildApimartImageBodyFields(),
  };

  if (styleLora) {
    body.lora = styleLora;
  }

  if (process.env.OPENAI_LORA_SCALE) {
    body.lora_scale = parseFloat(process.env.OPENAI_LORA_SCALE);
  }

  const r = await fetch(`${baseUrl}/images/generations`, {
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
    throw new Error(`OpenAI Image 请求失败: ${r.status} ${text.slice(0, 500)}`);
  }

  if (!r.ok) {
    throw new Error(`OpenAI Image API 错误: ${r.status} ${text.slice(0, 800)}`);
  }

  // apimart.ai 采用异步任务模式
  // 首次调用返回 task_id，需要轮询查询状态
  // 注意：apimart.ai 的响应格式是 {"code":200,"data":[{"status":"submitted","task_id":"..."}]}
  // data 是一个数组，需要取第一个元素
  const taskData = json.data instanceof Array ? json.data[0] : json.data;
  const taskId = taskData?.task_id;
  if (taskId) {
    console.log(`[OpenAI] 任务已提交: ${taskId}`);
    return await pollTaskStatus(baseUrl, apiKey, taskId);
  }

  // 尝试直接获取图片 URL（兼容同步模式）
  const imageUrl = parseSeedreamImageResponse(json);
  if (!imageUrl) {
    throw new Error(`OpenAI Image 返回中未找到图片 URL，原始响应: ${text.slice(0, 600)}`);
  }
  return imageUrl;
}

async function pollTaskStatus(baseUrl, apiKey, taskId) {
  const maxRetries = Number(process.env.OPENAI_POLL_MAX_RETRIES) || 45;
  const retryInterval = Number(process.env.OPENAI_POLL_INTERVAL_MS) || 4000;
  const initialDelay = Number(process.env.OPENAI_POLL_INITIAL_DELAY_MS) || 12000;
  const endpoint = `${baseUrl}/tasks/${taskId}`;

  console.log(`[OpenAI] 等待 ${initialDelay}ms 后开始轮询: ${endpoint}`);
  await new Promise((resolve) => setTimeout(resolve, initialDelay));

  for (let i = 0; i < maxRetries; i++) {
    try {
      const r = await fetch(endpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const text = await r.text();
      if (!r.ok) {
        console.log(`[OpenAI] 查询失败 HTTP ${r.status}: ${text.slice(0, 300)}`);
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
        continue;
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        console.log(`[OpenAI] 响应非 JSON: ${text.slice(0, 200)}`);
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
        continue;
      }

      const taskData = Array.isArray(json.data) ? json.data[0] : json.data;
      const status = taskData?.status || json.status;
      console.log(`[OpenAI] 任务状态: ${status} (第 ${i + 1}/${maxRetries} 次)`);

      if (status === "succeeded" || status === "completed" || status === "success") {
        const imageUrl = extractApimartImageUrl(taskData);
        if (imageUrl) {
          console.log(`[OpenAI] 图片 URL 已获取`);
          return imageUrl;
        }
        throw new Error(`任务已完成但未解析到图片 URL，响应片段: ${text.slice(0, 400)}`);
      }

      if (status === "failed" || status === "error") {
        const err = taskData?.error;
        const errorMsg =
          (typeof err === "object" && err !== null ? err.message : err) ||
          taskData?.message ||
          (typeof json.error === "object" ? json.error?.message : json.error) ||
          "未知错误";
        throw new Error(`任务失败: ${errorMsg}`);
      }

      if (status !== "submitted" && status !== "processing" && status !== "pending") {
        console.log(`[OpenAI] 未知状态 ${status}，继续轮询`);
      }
    } catch (e) {
      if (e.message?.startsWith("任务失败:") || e.message?.includes("但未解析到图片")) {
        throw e;
      }
      console.log(`[OpenAI] 轮询异常: ${e.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, retryInterval));
  }

  throw new Error(`任务超时，已轮询 ${maxRetries} 次（约 ${Math.round((initialDelay + maxRetries * retryInterval) / 1000)} 秒）`);
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

app.get("/api/styles", (_req, res) => {
  res.json(styleLibrary);
});

/** 获取单个风格的详细信息 */
app.get("/api/styles/:id", (req, res) => {
  const style = styleLibrary.find(s => s.id === req.params.id);
  if (style) {
    res.json(style);
  } else {
    res.status(404).json({ error: `未找到ID为 ${req.params.id} 的风格。` });
  }
});

/**
 * POST multipart: fields actual (file), effect (file), notes (optional text)
 */
app.post("/api/generate", upload.fields([{ name: "actual", maxCount: 1 }, { name: "effect", maxCount: 1 }]), async (req, res) => {
  try {
    if (!imageProvider) {
      return res.status(503).json({
        error:
          "未配置图像后端。请设置 IMAGE_PROVIDER=replicate、seedream 或 openai，并配置对应 API（见 README / .env.example）。",
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

    if (imageProvider === "openai" && !process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "已选择 OpenAI，但未配置 OPENAI_API_KEY。" });
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
    } else if (imageProvider === "openai") {
      promptUsed = buildEditPrompt(styleDescription);
      imageUrl = await generateWithOpenAI(promptUsed, actualFile.buffer, actualMime);
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

app.post("/api/generate-by-style/:styleId?", upload.single("image"), async (req, res) => {
  try {
    // 支持从 URL 参数或请求体中获取 styleId
    const styleId = req.params.styleId || req.body.styleId;
    const imageFile = req.file;

    if (!imageFile) {
      return res.status(400).json({ error: "请上传您的房间图片。" });
    }

    if (!styleId) {
      return res.status(400).json({ error: "未指定风格ID。" });
    }

    const style = styleLibrary.find(s => s.id === styleId);
    if (!style) {
      return res.status(404).json({ error: `未找到ID为 ${styleId} 的风格。` });
    }

    if ((imageProvider !== "replicate" && imageProvider !== "openai") || !replicate && imageProvider === "replicate") {
      return res.status(503).json({ error: "此功能当前仅支持 Replicate 或 OpenAI 后端。请检查配置。" });
    }

    const prompt = (style.generatePrompt || style.keywords.join(", ")).trim();
    const imageDataUri = `data:${imageFile.mimetype};base64,${imageFile.buffer.toString("base64")}`;
    let imageUrl;

    if (imageProvider === "openai") {
      const styleLora = style.lora || process.env.DEFAULT_OPENAI_LORA || null;
      imageUrl = await generateWithOpenAI(prompt, imageFile.buffer, imageFile.mimetype, styleLora);
    } else {
      const output = await replicate.run(
        "lucataco/sdxl-controlnet-depth:5e0a5cda895aa23a1aaa1a9a265220097102448e1b4c42b22a3c6d87c12d41a9",
        {
          input: {
            image: imageDataUri,
            prompt: prompt,
            condition_scale: 0.7,
          },
        }
      );
      imageUrl = normalizeImageUrl(output);
    }

    if (!imageUrl) {
      return res.status(500).json({ error: "模型未返回有效图片地址。" });
    }

    return res.json({ imageUrl });

  } catch (e) {
    console.error("按风格生成失败:", e);
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

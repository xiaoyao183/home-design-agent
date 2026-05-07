/**
 * 前端逻辑：健康检查、本地预览两张上传图、调用 /api/generate 获取 AI 合成结果。
 */
(function () {
  /** API 健康检查端点 */
  const HEALTH_URL = "/api/health";
  /** 生成接口 */
  const GENERATE_URL = "/api/generate";

  /** 页面加载完成后绑定事件 */
  document.addEventListener("DOMContentLoaded", init);

  /**
   * 初始化：拉取服务状态、绑定表单与预览。
   */
  function init() {
    const form = document.getElementById("upload-form");
    const actualInput = document.getElementById("actual-input");
    const effectInput = document.getElementById("effect-input");
    const statusPill = document.getElementById("status-pill");

    refreshHealth(statusPill);

    actualInput.addEventListener("change", () => previewFile(actualInput, document.getElementById("actual-preview")));
    effectInput.addEventListener("change", () => previewFile(effectInput, document.getElementById("effect-preview")));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitGenerate(form);
    });
  }

  /**
   * 请求 /api/health，更新顶部状态徽标文案。
   * @param {HTMLElement} el 状态容器元素
   */
  async function refreshHealth(el) {
    try {
      const r = await fetch(HEALTH_URL);
      const j = await r.json();
      if (j.replicateConfigured) {
        el.textContent = "已连接 AI 服务（Replicate）";
        el.classList.add("ok");
      } else {
        el.textContent = "未配置 API：请运行后端并设置 REPLICATE_API_TOKEN";
        el.classList.remove("ok");
      }
    } catch {
      el.textContent = "无法连接本地服务：请先执行 npm start";
      el.classList.remove("ok");
    }
  }

  /**
   * 将用户选择的本地图片显示在预览区域。
   * @param {HTMLInputElement} input 文件 input
   * @param {HTMLElement} container 预览容器（内需有 img 与 .placeholder）
   */
  function previewFile(input, container) {
    const img = container.querySelector("img");
    const ph = container.querySelector(".placeholder");
    const file = input.files && input.files[0];
    if (!file) {
      img.removeAttribute("src");
      img.hidden = true;
      ph.hidden = false;
      return;
    }
    const url = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(url);
    img.src = url;
    img.hidden = false;
    ph.hidden = true;
  }

  /**
   * 提交 multipart 表单到后端生成预览图。
   * @param {HTMLFormElement} form 表单节点
   */
  async function submitGenerate(form) {
    const btn = document.getElementById("btn-generate");
    const loading = document.getElementById("loading");
    const errBox = document.getElementById("error");
    const resultImg = document.getElementById("result-img");
    const resultPh = document.getElementById("result-placeholder");
    const promptPre = document.getElementById("prompt-used");

    errBox.textContent = "";
    loading.hidden = false;
    btn.disabled = true;
    resultImg.hidden = true;
    resultPh.hidden = false;
    promptPre.textContent = "";

    const fd = new FormData(form);

    try {
      const res = await fetch(GENERATE_URL, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText || "生成失败");
      }
      resultImg.src = data.imageUrl;
      resultImg.hidden = false;
      resultPh.hidden = true;
      if (data.promptUsed) {
        promptPre.textContent = data.promptUsed;
      }
    } catch (e) {
      errBox.textContent = e.message || String(e);
    } finally {
      loading.hidden = true;
      btn.disabled = false;
    }
  }
})();

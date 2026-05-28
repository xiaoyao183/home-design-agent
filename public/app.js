/**
 * 前端逻辑：健康检查、本地预览两张上传图、调用 /api/generate 获取 AI 合成结果。
 */
(function () {
  const HEALTH_URL = "/api/health";
  const GENERATE_URL = "/api/generate";
  const STYLES_URL = "/api/styles";
  const GENERATE_BY_STYLE_URL = "/api/generate-by-style";

  // 当前选中的风格详情
  let currentStyle = null;
  
  // 页面元素引用（全局变量，让所有函数都能访问）
  let pageGallery, pagePrecise, pageDetail;
  let btnShowGallery, btnShowPrecise;

  document.addEventListener("DOMContentLoaded", init);

  /**
   * 显示指定页面（全局函数，所有函数都能访问）
   */
  function showPage(pageToShow) {
    console.log("Showing page:", pageToShow.id);
    pageGallery.hidden = (pageToShow !== pageGallery);
    pagePrecise.hidden = (pageToShow !== pagePrecise);
    pageDetail.hidden = (pageToShow !== pageDetail);

    const isGalleryPage = pageToShow === pageGallery;
    btnShowGallery.classList.toggle("active", isGalleryPage);
    btnShowPrecise.classList.toggle("active", pageToShow === pagePrecise);

    if (isGalleryPage) {
      window.scrollTo(0, 0);
    }
  }

  /**
   * 加载风格画廊，实现竖版3:4和横版4:3交替布局
   * 1、3、5是竖版3:4，2、4、6是横版4:3
   */
  async function loadStyleGallery() {
    const container = document.getElementById("style-gallery-scroll");
    if (!container) return;

    try {
      const res = await fetch(STYLES_URL);
      const styles = await res.json();

      // 过滤并排序为指定的6种风格
      const styleOrder = ["bauhaus", "mid-century", "aalto", "modern-minimalist", "japandi", "french-country"];
      const filteredStyles = styles
        .filter(s => styleOrder.includes(s.id))
        .sort((a, b) => styleOrder.indexOf(a.id) - styleOrder.indexOf(b.id));

      container.innerHTML = "";

      filteredStyles.forEach((style, index) => {
        const card = document.createElement("div");
        // 第1、3、5个（索引0、2、4）是竖版3:4，第2、4、6个（索引1、3、5）是横版4:3
        const isVertical = index % 2 === 0;
        card.className = `style-card ${isVertical ? "vertical" : "horizontal"}`;
        card.dataset.styleId = style.id;

        const image = document.createElement("img");
        image.className = "style-card-image";
        image.src = style.image;
        image.alt = style.name;
        image.loading = "lazy";

        // 风格名称独立显示在图片下方
        const name = document.createElement("div");
        name.className = "style-card-name";
        name.textContent = style.name;

        card.appendChild(image);
        card.appendChild(name);
        card.addEventListener("click", () => {
          handleStyleCardClick(style);
        });

        container.appendChild(card);
      });

      setupScrollButton();
    } catch (e) {
      console.error("Failed to load style gallery:", e);
      container.innerHTML = `<p class="error-msg">无法加载风格库，请检查后端服务是否正常。</p>`;
    }
  }

  /**
   * 处理风格卡片点击 - 跳转到风格详情页面
   */
  function handleStyleCardClick(style) {
    console.log("Style card clicked:", style.name);
    console.log("Detail page element:", document.getElementById("page-style-detail"));
    
    currentStyle = style;
    
    // 更新风格详情页面内容
    const titleEl = document.getElementById("style-detail-title");
    const descEl = document.getElementById("style-detail-description");
    const historyEl = document.getElementById("style-detail-history");
    
    if (titleEl) titleEl.textContent = style.name;
    if (descEl) descEl.textContent = style.description || "暂无介绍";
    if (historyEl) historyEl.textContent = style.history || "暂无历史介绍";
    
    // 加载风格图库
    const galleryContainer = document.getElementById("style-detail-gallery-images");
    if (galleryContainer) {
      galleryContainer.innerHTML = "";
      (style.gallery || []).forEach((imgSrc, index) => {
        const img = document.createElement("img");
        img.src = imgSrc;
        img.alt = `${style.name} 示例图 ${index + 1}`;
        galleryContainer.appendChild(img);
      });
    }
    
    // 显示风格详情页面，隐藏其他页面
    const detailPage = document.getElementById("page-style-detail");
    if (detailPage) {
      console.log("Showing detail page");
      showPage(detailPage);
    } else {
      console.error("Detail page element not found!");
    }
    
    // 滚动到页面顶部
    window.scrollTo(0, 0);
  }

  /**
   * 设置滚动按钮功能
   */
  function setupScrollButton() {
    const scrollContainer = document.getElementById("style-gallery-scroll");
    const scrollButton = document.getElementById("btn-scroll-next");
    
    if (!scrollContainer || !scrollButton) return;

    function checkScrollButton() {
      const isScrollable = scrollContainer.scrollWidth > scrollContainer.clientWidth;
      const isAtEnd = scrollContainer.scrollLeft >= scrollContainer.scrollWidth - scrollContainer.clientWidth - 10;
      
      if (isScrollable && !isAtEnd) {
        scrollButton.classList.remove("hidden");
      } else {
        scrollButton.classList.add("hidden");
      }
    }

    setTimeout(checkScrollButton, 100);
    scrollContainer.addEventListener("scroll", checkScrollButton);
    window.addEventListener("resize", checkScrollButton);

    scrollButton.addEventListener("click", () => {
      const scrollAmount = 550;
      scrollContainer.scrollBy({
        left: scrollAmount,
        behavior: "smooth"
      });
    });
  }

  function init() {
    console.log("App initialized");
    console.log("Detail page exists:", !!document.getElementById("page-style-detail"));
    
    // 初始化页面元素引用
    btnShowGallery = document.getElementById("btn-show-gallery");
    btnShowPrecise = document.getElementById("btn-show-precise");
    const btnBackToGallery = document.getElementById("btn-back-to-gallery");

    pageGallery = document.getElementById("page-style-gallery");
    pagePrecise = document.getElementById("page-precise-generation");
    pageDetail = document.getElementById("page-style-detail");

    console.log("Pages found:", { pageGallery: !!pageGallery, pagePrecise: !!pagePrecise, pageDetail: !!pageDetail });

    loadStyleGallery();

    btnShowGallery.addEventListener("click", () => showPage(pageGallery));
    btnShowPrecise.addEventListener("click", () => showPage(pagePrecise));
    btnBackToGallery.addEventListener("click", () => showPage(pageGallery));

    // 注册/登录按钮
    const btnRegister = document.getElementById("btn-register");
    const btnLogin = document.getElementById("btn-login");

    btnRegister.addEventListener("click", () => {
      alert("注册功能即将推出");
    });

    btnLogin.addEventListener("click", () => {
      alert("登录功能即将推出");
    });

    // 精准生成表单
    const preciseForm = document.getElementById("upload-form");
    const actualInput = document.getElementById("actual-input");
    const effectInput = document.getElementById("effect-input");

    actualInput.addEventListener("change", () => previewFile(actualInput, document.getElementById("actual-preview")));
    effectInput.addEventListener("change", () => previewFile(effectInput, document.getElementById("effect-preview")));

    preciseForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitGenerate(preciseForm, false);
    });

    // 风格生成表单
    const styleGenerateForm = document.getElementById("style-generate-form");
    const styleGenerateInput = document.getElementById("style-generate-input");

    styleGenerateInput.addEventListener("change", () => previewFile(styleGenerateInput, document.getElementById("style-generate-preview")));

    styleGenerateForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitStyleGenerate(styleGenerateForm);
    });

    refreshHealth();
  }

  /**
   * 健康检查
   */
  async function refreshHealth() {
    try {
      const r = await fetch(HEALTH_URL);
      const j = await r.json();
      console.log("Service status:", j);
    } catch {
      console.log("无法连接本地服务");
    }
  }

  /**
   * 预览上传的图片
   */
  function previewFile(input, container) {
    const img = container.querySelector("img");
    const ph = container.querySelector(".placeholder");
    const file = input.files && input.files[0];
    if (!file) {
      img.removeAttribute("src");
      img.hidden = true;
      ph.hidden = false;
      container.setAttribute("aria-hidden", "true");
      return;
    }
    const url = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(url);
    img.src = url;
    img.hidden = false;
    ph.hidden = true;
    container.setAttribute("aria-hidden", "false");
  }

  /**
   * 提交精准生成请求
   */
  async function submitGenerate(form, isStyleGenerate = false) {
    const prefix = isStyleGenerate ? "style-generate" : "";
    const btn = document.getElementById(isStyleGenerate ? "btn-style-generate" : "btn-generate");
    const loading = document.getElementById(isStyleGenerate ? "style-generate-loading" : "loading");
    const errBox = document.getElementById(isStyleGenerate ? "style-generate-error" : "error");
    const resultImg = document.getElementById(isStyleGenerate ? "style-result-img" : "result-img");
    const resultPh = document.getElementById(isStyleGenerate ? "style-result-placeholder" : "result-placeholder");
    const promptPre = document.getElementById("prompt-used");

    errBox.textContent = "";
    loading.hidden = false;
    btn.disabled = true;
    resultImg.hidden = true;
    resultPh.hidden = false;
    if (promptPre) promptPre.textContent = "";

    const fd = new FormData(form);

    try {
      const url = isStyleGenerate ? `${GENERATE_BY_STYLE_URL}/${currentStyle?.id}` : GENERATE_URL;
      const res = await fetch(url, {
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
      if (data.promptUsed && promptPre) {
        promptPre.textContent = data.promptUsed;
      }
    } catch (e) {
      errBox.textContent = e.message || String(e);
    } finally {
      loading.hidden = true;
      btn.disabled = false;
    }
  }

  /**
   * 提交风格生成请求
   */
  async function submitStyleGenerate(form) {
    if (!currentStyle) {
      alert("请先选择一个风格");
      return;
    }
    await submitGenerate(form, true);
  }
})();
(() => {
  "use strict";

  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;
  const MINUTE = 60 * 1000;
  const STORAGE_KEY = "lunaris-settings-v2";
  const LOVED_KEY = "lunaris-loved-memories-v1";
  const WISH_KEY = "lunaris-wish-v1";
  const DEFAULT_SETTINGS = Object.freeze({
    myName: "我",
    girlName: "宝贝",
    anniversary: "2026-10-17",
  });

  const DEFAULT_MEMORIES = Object.freeze(
    Array.from({ length: 6 }, (_, index) => ({
      id: `memory-empty-${index + 1}`,
      placeholder: true,
      title: "待放入一张照片",
      note: "等你们把这一刻放进来。",
      date: "照片待编辑",
      number: String(index + 1).padStart(2, "0"),
    })),
  );

  const GAME_NOTES = [
    "你接住了：温柔",
    "你接住了：偏爱",
    "你接住了：勇敢",
    "你接住了：想念",
    "你接住了：可爱",
    "你接住了：安心",
    "你接住了：浪漫",
    "你接住了：全部的我",
  ];

  const DAILY_LOVES = [
    "今天也爱你，比昨天多一点。",
    "所有星星都在赶路，而我刚好走向你。",
    "今天的心动，已经偷偷刷新纪录。",
    "世界很大，我的喜欢只朝你生长。",
    "在普通的一天里，第无数次重新喜欢你。",
    "今晚的月亮很好，但我还是更想看你。",
    "如果心动有回声，你大概每天都能听见我。",
  ];

  const PLANET_MESSAGES = [
    "宇宙密语：你是我最确定的偏航。",
    "宇宙密语：我的引力中心，只有一个你。",
    "宇宙密语：喜欢你这件事，没有光年那么远。",
    "宇宙密语：所有浪漫，最终都指向你。",
    "宇宙密语：今天也请继续做我的小宇宙。",
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const pad = (value) => String(value).padStart(2, "0");
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  let settings = loadSettings();
  let lovedMemories = loadLovedMemories();
  let uploadedMemories = [];
  let currentMemory = null;
  let toastTimer = null;
  let revealObserver = null;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isTouch = window.matchMedia("(hover: none)").matches;

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseLocalDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return parseLocalDate(DEFAULT_SETTINGS.anniversary);
    }
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? parseLocalDate(DEFAULT_SETTINGS.anniversary) : date;
  }

  function toDateInputValue(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatDateDot(date) {
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
  }

  function formatDateCN(date) {
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }

  function formatCount(value) {
    return new Intl.NumberFormat("zh-CN").format(value);
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...DEFAULT_SETTINGS };
      return {
        myName: String(saved.myName || DEFAULT_SETTINGS.myName).slice(0, 12),
        girlName: String(saved.girlName || DEFAULT_SETTINGS.girlName).slice(0, 12),
        anniversary: /^\d{4}-\d{2}-\d{2}$/.test(saved.anniversary)
          ? saved.anniversary
          : DEFAULT_SETTINGS.anniversary,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn("Could not save settings:", error);
    }
  }

  function loadLovedMemories() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOVED_KEY) || "[]");
      return new Set(Array.isArray(saved) ? saved : []);
    } catch {
      return new Set();
    }
  }

  function saveLovedMemories() {
    try {
      localStorage.setItem(LOVED_KEY, JSON.stringify([...lovedMemories]));
    } catch (error) {
      console.warn("Could not save memory favorites:", error);
    }
  }

  function renderNames() {
    const girlName = settings.girlName || DEFAULT_SETTINGS.girlName;
    const myName = settings.myName || DEFAULT_SETTINGS.myName;

    $("#heroGirlName").textContent = girlName;
    $("#marqueeGirlName").textContent = girlName;
    $("#envelopeGirlName").textContent = girlName;
    $("#envelopeMyName").textContent = myName;
    $("#letterGirlName").textContent = girlName;
    $("#letterMyName").textContent = myName;

    $$(".marquee-track b").forEach((node) => {
      if (!node.id) node.textContent = girlName;
    });

    const letterNumber = settings.anniversary.replaceAll("-", "").slice(4);
    $("#letterNumber").textContent = letterNumber;
  }

  function getTimeState() {
    const now = new Date();
    const start = parseLocalDate(settings.anniversary);
    const elapsed = Math.max(0, now.getTime() - start.getTime());
    const daysTogether = Math.max(1, Math.floor(elapsed / DAY) + 1);

    const thisYearsAnniversary = new Date(
      now.getFullYear(),
      start.getMonth(),
      start.getDate(),
      0,
      0,
      0,
      0,
    );
    let nextAnniversary = new Date(thisYearsAnniversary);

    if (
      nextAnniversary.getFullYear() === now.getFullYear() &&
      nextAnniversary.getMonth() === now.getMonth() &&
      nextAnniversary.getDate() === now.getDate()
    ) {
      nextAnniversary.setHours(23, 59, 59, 999);
    } else if (nextAnniversary.getTime() <= now.getTime()) {
      nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);
    }

    const anniversaryNumber = Math.max(1, nextAnniversary.getFullYear() - start.getFullYear());
    const previousAnniversary = new Date(nextAnniversary);
    previousAnniversary.setFullYear(previousAnniversary.getFullYear() - 1);
    const yearDuration = Math.max(1, nextAnniversary.getTime() - previousAnniversary.getTime());
    const yearProgress = clamp(
      ((now.getTime() - previousAnniversary.getTime()) / yearDuration) * 100,
      0,
      100,
    );
    const countdown = Math.max(0, nextAnniversary.getTime() - now.getTime());

    return {
      now,
      start,
      elapsed,
      daysTogether,
      nextAnniversary,
      previousAnniversary,
      anniversaryNumber,
      yearProgress,
      countdown,
    };
  }

  function updateTimeDisplay() {
    const state = getTimeState();
    const elapsed = state.elapsed;
    const dayCount = Math.floor(elapsed / DAY);
    const hours = Math.floor((elapsed % DAY) / HOUR);
    const minutes = Math.floor((elapsed % HOUR) / MINUTE);
    const seconds = Math.floor((elapsed % MINUTE) / 1000);
    const daysUntil = Math.ceil(state.countdown / DAY);
    const countdownDays = Math.floor(state.countdown / DAY);
    const countdownHours = Math.floor((state.countdown % DAY) / HOUR);
    const countdownMinutes = Math.floor((state.countdown % HOUR) / MINUTE);
    const countdownSeconds = Math.floor((state.countdown % MINUTE) / 1000);

    $("#heroDays").textContent = formatCount(state.daysTogether);
    $("#heroCountdown").textContent = pad(daysUntil);
    $("#anniversaryInline").textContent = formatDateDot(state.start);
    $("#liveDays").textContent = formatCount(dayCount);
    $("#liveHours").textContent = pad(hours);
    $("#liveMinutes").textContent = pad(minutes);
    $("#liveSeconds").textContent = pad(seconds);
    $("#nextAnniversaryTitle").textContent = `第 ${state.anniversaryNumber} 个周年`;
    $("#nextAnniversaryDate").textContent = formatDateDot(state.nextAnniversary);
    $("#countdownDays").textContent = String(countdownDays).padStart(3, "0");
    $("#countdownHours").textContent = pad(countdownHours);
    $("#countdownMinutes").textContent = pad(countdownMinutes);
    $("#countdownSeconds").textContent = pad(countdownSeconds);
    $("#lastAnniversaryLabel").textContent = `上一站 / ${formatDateDot(state.previousAnniversary)}`;
    $("#progressPercent").textContent = `${Math.round(state.yearProgress)}%`;
    $("#yearProgressBar").style.width = `${state.yearProgress}%`;
    const progressDot = $(".progress-track i");
    if (progressDot) progressDot.style.left = `${state.yearProgress}%`;
    $("#relationshipPhase").textContent = `YEAR ${pad(state.anniversaryNumber)}`;
    $("#sunriseCount").textContent = formatCount(state.daysTogether);
  }

  function updateDailyLove() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - startOfYear) / DAY);
    $("#dailyLove").textContent = DAILY_LOVES[dayOfYear % DAILY_LOVES.length];
  }

  function updateLetterDate() {
    const formatted = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    })
      .format(new Date())
      .toUpperCase();
    $("#letterDate").textContent = formatted;
  }

  function showToast(message) {
    const toast = $("#toast");
    $("#toastText").textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 3200);
  }

  function setupReveal() {
    const nodes = $$(".reveal, .memory-card").filter((node) => !node.dataset.revealBound);
    if (!("IntersectionObserver" in window) || prefersReducedMotion.matches) {
      nodes.forEach((node) => {
        node.classList.add("is-visible");
        node.dataset.revealBound = "true";
      });
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
      );
    }

    nodes.forEach((node) => {
      node.dataset.revealBound = "true";
      revealObserver.observe(node);
    });
  }

  function setupHeaderAndNav() {
    const header = $("#siteHeader");
    const progress = $("#scrollProgress");
    const nav = $("#siteNav");
    const menuButton = $("#menuButton");

    const updateScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      header.classList.toggle("is-scrolled", scrollTop > 30);
      progress.style.width = `${maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0}%`;
    };

    const closeMenu = () => {
      nav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    };

    menuButton.addEventListener("click", () => {
      const willOpen = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", willOpen);
      menuButton.setAttribute("aria-expanded", String(willOpen));
    });

    $$("a", nav).forEach((link) => link.addEventListener("click", closeMenu));

    document.addEventListener("click", (event) => {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(event.target) || menuButton.contains(event.target)) return;
      closeMenu();
    });

    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);
    updateScroll();

    const sectionLinks = $$(".site-nav a");
    if ("IntersectionObserver" in window) {
      const sectionObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (!visible) return;
          const hash = `#${visible.target.id}`;
          sectionLinks.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === hash);
          });
        },
        { rootMargin: "-35% 0px -50% 0px", threshold: [0, 0.12, 0.5] },
      );

      $$("main section[id]").forEach((section) => sectionObserver.observe(section));
    }
  }

  function setupSkyCanvas() {
    const canvas = $("#skyCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let stars = [];
    let shootingStars = [];
    let rafId = 0;
    let time = 0;
    const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(clamp((width * height) / 8200, 90, 240));
      stars = Array.from({ length: count }, (_, index) => ({
        x: Math.random(),
        y: Math.random(),
        radius: Math.random() * 1.15 + 0.25,
        opacity: Math.random() * 0.65 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.7 + 0.25,
        depth: Math.random() * 0.8 + 0.2,
        warm: index % 9 === 0,
      }));
    };

    const drawStar = (star) => {
      const offsetX = (pointer.x - 0.5) * 14 * star.depth;
      const offsetY = (pointer.y - 0.5) * 14 * star.depth;
      const x = star.x * width + offsetX;
      const y = star.y * height + offsetY;
      const twinkle = prefersReducedMotion.matches
        ? 1
        : 0.72 + Math.sin(time * star.speed + star.phase) * 0.28;
      ctx.beginPath();
      ctx.fillStyle = star.warm
        ? `rgba(244, 209, 169, ${star.opacity * twinkle})`
        : `rgba(228, 236, 238, ${star.opacity * twinkle})`;
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawShootingStar = (shooting) => {
      const alpha = clamp(shooting.life, 0, 1);
      const tailX = shooting.x - shooting.vx * 0.14;
      const tailY = shooting.y - shooting.vy * 0.14;
      const gradient = ctx.createLinearGradient(shooting.x, shooting.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(255, 239, 210, ${alpha})`);
      gradient.addColorStop(1, "rgba(255, 239, 210, 0)");
      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.2;
      ctx.moveTo(shooting.x, shooting.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 245, 225, ${alpha})`;
      ctx.arc(shooting.x, shooting.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    };

    const addShootingStar = () => {
      const startX = Math.random() * width * 0.75;
      const startY = Math.random() * height * 0.35;
      shootingStars.push({
        x: startX,
        y: startY,
        vx: 330 + Math.random() * 140,
        vy: 170 + Math.random() * 70,
        life: 1,
      });
    };

    const frame = (timestamp) => {
      time = timestamp / 1000;
      pointer.x += (pointer.targetX - pointer.x) * 0.025;
      pointer.y += (pointer.targetY - pointer.y) * 0.025;
      ctx.clearRect(0, 0, width, height);
      stars.forEach(drawStar);

      if (!isTouch && Math.random() < 0.0016) addShootingStar();

      shootingStars = shootingStars.filter((shooting) => shooting.life > 0);
      shootingStars.forEach((shooting) => {
        const delta = 16.67 / 1000;
        shooting.x += shooting.vx * delta;
        shooting.y += shooting.vy * delta;
        shooting.life -= 0.018;
        drawShootingStar(shooting);
      });

      rafId = requestAnimationFrame(frame);
    };

    window.addEventListener("resize", resize);
    window.addEventListener(
      "pointermove",
      (event) => {
        pointer.targetX = event.clientX / width;
        pointer.targetY = event.clientY / height;
      },
      { passive: true },
    );

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(frame);
      }
    });

    resize();
    rafId = requestAnimationFrame(frame);
  }

  function setupPointerHalo() {
    const halo = $("#pointerHalo");
    if (!halo || isTouch) return;
    let raf = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;

    const render = () => {
      x += (targetX - x) * 0.11;
      y += (targetY - y) * 0.11;
      halo.style.transform = `translate(${x - 210}px, ${y - 210}px)`;
      raf = requestAnimationFrame(render);
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        targetX = event.clientX;
        targetY = event.clientY;
        halo.style.opacity = "0.16";
      },
      { passive: true },
    );
    document.addEventListener("mouseleave", () => {
      halo.style.opacity = "0";
    });
    document.addEventListener("mouseenter", () => {
      halo.style.opacity = "0.16";
    });

    render();
    window.addEventListener("beforeunload", () => cancelAnimationFrame(raf));
  }

  function setupSettings() {
    const dialog = $("#settingsDialog");
    const form = $("#settingsForm");
    const myNameInput = $("#myNameInput");
    const girlNameInput = $("#girlNameInput");
    const anniversaryInput = $("#anniversaryInput");
    const todayValue = toDateInputValue(new Date());
    anniversaryInput.max = todayValue;

    const fillForm = () => {
      myNameInput.value = settings.myName;
      girlNameInput.value = settings.girlName;
      anniversaryInput.value = settings.anniversary;
    };

    const open = () => {
      fillForm();
      openDialog(dialog);
    };

    $("#settingsButton").addEventListener("click", open);
    $("#openSettingsInline").addEventListener("click", open);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const anniversary = anniversaryInput.value || DEFAULT_SETTINGS.anniversary;
      if (parseLocalDate(anniversary).getTime() > Date.now()) {
        showToast("纪念日要选一个已经发生的日子");
        anniversaryInput.focus();
        return;
      }

      settings = {
        myName: myNameInput.value.trim().slice(0, 12) || DEFAULT_SETTINGS.myName,
        girlName: girlNameInput.value.trim().slice(0, 12) || DEFAULT_SETTINGS.girlName,
        anniversary,
      };
      saveSettings();
      renderNames();
      updateTimeDisplay();
      updateLetterDate();
      dialog.close();
      showToast("我们的宇宙，已经重新校准");
    });

    $("#resetSettingsButton").addEventListener("click", () => {
      settings = { ...DEFAULT_SETTINGS };
      saveSettings();
      fillForm();
      renderNames();
      updateTimeDisplay();
      updateLetterDate();
      showToast("已恢复最初的那片星空");
    });
  }

  function setupDialogs() {
    $$("button[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => {
        const dialog = button.closest("dialog");
        if (dialog?.open) dialog.close();
      });
    });

    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("close", () => {
        if (!$$("dialog").some((item) => item.open)) {
          document.body.classList.remove("is-dialog-open");
        }
      });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    });

    $$("[data-open-letter]").forEach((button) => {
      button.addEventListener("click", () => {
        renderNames();
        updateLetterDate();
        openDialog($("#letterDialog"));
      });
    });
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    document.body.classList.add("is-dialog-open");
    refreshIcons();
  }

  function setupPlanetInteraction() {
    const planetSystem = $("#planetSystem");
    const planet = $(".planet");
    if (!planetSystem || !planet) return;

    planetSystem.tabIndex = 0;
    planetSystem.setAttribute("role", "button");
    planetSystem.setAttribute("aria-label", "轻触星球，接收一句宇宙密语");

    const sendMessage = (event) => {
      const rect = planetSystem.getBoundingClientRect();
      const message = PLANET_MESSAGES[Math.floor(Math.random() * PLANET_MESSAGES.length)];
      showToast(message);
      burstHearts(
        event?.clientX ?? rect.left + rect.width / 2,
        event?.clientY ?? rect.top + rect.height / 2,
        8,
      );
    };

    planet.addEventListener("click", sendMessage);
    planetSystem.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        sendMessage();
      }
    });
  }

  function sceneMarkup(scene, title) {
    let details = "";
    if (scene === "beach") details = '<span class="scene-sun"></span><span class="scene-birds"></span>';
    if (scene === "sunset") details = '<span class="scene-sun"></span>';
    if (scene === "galaxy") details = '<span class="scene-moon"></span>';
    if (scene === "city") details = '<span class="scene-city-moon"></span>';
    if (scene === "desert") details = '<span class="scene-sun"></span><span class="scene-star"></span>';
    return `<div class="scene scene-${escapeHTML(scene)}" role="img" aria-label="${escapeHTML(title)}">${details}</div>`;
  }

  function allMemories() {
    const emptySlots = DEFAULT_MEMORIES.slice(
      Math.min(uploadedMemories.length, DEFAULT_MEMORIES.length),
    );
    return [...uploadedMemories, ...emptySlots];
  }

  function memoryCardMarkup(memory) {
    const isUploaded = Boolean(memory.uploaded);
    if (memory.placeholder) {
      return `
        <figure class="memory-card is-editable" data-memory-id="${escapeHTML(memory.id)}" data-placeholder="true" tabindex="0" role="button" aria-label="待编辑照片位，点击添加照片">
          <div class="memory-visual">
            <div class="memory-empty" role="img" aria-label="待编辑照片位">
              <span class="empty-orbit"><i data-lucide="image-plus"></i></span>
              <strong>待编辑</strong>
              <small>点击放入你们的照片</small>
            </div>
            <span class="memory-number">${escapeHTML(memory.number)}</span>
          </div>
        </figure>
      `;
    }

    const isLoved = lovedMemories.has(memory.id);
    const media = `<img src="${escapeHTML(memory.src)}" alt="${escapeHTML(memory.title)}" loading="lazy">`;

    return `
      <figure class="memory-card${isUploaded ? " is-uploaded" : ""}" data-memory-id="${escapeHTML(memory.id)}" tabindex="0" role="button" aria-label="查看回忆：${escapeHTML(memory.title)}">
        <div class="memory-visual">
          ${media}
          <span class="memory-number">${escapeHTML(memory.number)}</span>
          <button class="memory-like${isLoved ? " is-loved" : ""}" type="button" data-like-memory="${escapeHTML(memory.id)}" aria-label="收藏${escapeHTML(memory.title)}" aria-pressed="${isLoved}">
            <i data-lucide="heart"></i>
          </button>
          <div class="memory-copy">
            <span>${escapeHTML(memory.date)}</span>
            <h3>${escapeHTML(memory.title)}</h3>
            <p>${escapeHTML(memory.note)}</p>
          </div>
        </div>
      </figure>
    `;
  }

  function renderGallery() {
    const grid = $("#memoryGrid");
    const memories = allMemories().map((memory, index) => ({
      ...memory,
      number: memory.uploaded ? pad(index + 1) : memory.number,
    }));
    grid.innerHTML = memories.map(memoryCardMarkup).join("");
    $("#memoryCount").textContent = pad(uploadedMemories.length);
    const syncPhotoCount = $("#syncPhotoCount");
    if (syncPhotoCount) syncPhotoCount.textContent = String(uploadedMemories.length);
    refreshIcons();
    setupReveal();
  }

  function toggleLoved(memoryId) {
    if (lovedMemories.has(memoryId)) {
      lovedMemories.delete(memoryId);
    } else {
      lovedMemories.add(memoryId);
      const card = $(`[data-memory-id="${CSS.escape(memoryId)}"]`);
      if (card) {
        const rect = card.getBoundingClientRect();
        burstHearts(rect.left + rect.width / 2, rect.top + rect.height / 2, 5);
      }
    }

    saveLovedMemories();
    const isLoved = lovedMemories.has(memoryId);
    $$(`[data-like-memory="${CSS.escape(memoryId)}"]`).forEach((button) => {
      button.classList.toggle("is-loved", isLoved);
      button.setAttribute("aria-pressed", String(isLoved));
    });

    if (currentMemory?.id === memoryId) {
      $("#lightboxHeart").classList.toggle("is-loved", isLoved);
      $("#lightboxHeart").setAttribute("aria-pressed", String(isLoved));
    }
  }

  function setupMemoryGrid() {
    const grid = $("#memoryGrid");

    grid.addEventListener("click", (event) => {
      const likeButton = event.target.closest("[data-like-memory]");
      if (likeButton) {
        event.stopPropagation();
        toggleLoved(likeButton.dataset.likeMemory);
        return;
      }

      const card = event.target.closest("[data-memory-id]");
      if (!card) return;
      if (card.dataset.placeholder === "true") {
        $("#photoInput").click();
        return;
      }
      openLightbox(card.dataset.memoryId);
    });

    grid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button")) return;
      const card = event.target.closest("[data-memory-id]");
      if (!card) return;
      event.preventDefault();
      if (card.dataset.placeholder === "true") {
        $("#photoInput").click();
        return;
      }
      openLightbox(card.dataset.memoryId);
    });

    $("#lightboxHeart").addEventListener("click", () => {
      if (currentMemory) toggleLoved(currentMemory.id);
    });
  }

  function openLightbox(memoryId) {
    const memory = allMemories().find((item) => item.id === memoryId);
    if (!memory || memory.placeholder) {
      $("#photoInput").click();
      return;
    }
    currentMemory = memory;

    const media = $("#lightboxMedia");
    media.innerHTML = `<img src="${escapeHTML(memory.src)}" alt="${escapeHTML(memory.title)}">`;

    $("#lightboxIndex").textContent = `MEMORY ${memory.number}`;
    $("#lightboxTitle").textContent = memory.title;
    $("#lightboxNote").textContent = memory.note;
    $("#lightboxDate").innerHTML = `<i data-lucide="calendar-heart"></i> ${escapeHTML(memory.date)}`;
    $("#captionInput").value = memory.caption || "";
    $("#uploadedActions").hidden = !memory.uploaded;
    const isLoved = lovedMemories.has(memory.id);
    $("#lightboxHeart").classList.toggle("is-loved", isLoved);
    $("#lightboxHeart").setAttribute("aria-pressed", String(isLoved));
    refreshIcons();
    openDialog($("#lightbox"));
  }

  let databasePromise = null;

  function openDatabase() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB unavailable"));
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("lunaris-memories", 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("photos")) {
          database.createObjectStore("photos", { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return databasePromise;
  }

  async function databaseRequest(mode, action) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("photos", mode);
      const store = transaction.objectStore("photos");
      let request;
      try {
        request = action(store);
      } catch (error) {
        reject(error);
        return;
      }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  const putPhoto = (record) => databaseRequest("readwrite", (store) => store.put(record));
  const deletePhoto = (id) => databaseRequest("readwrite", (store) => store.delete(id));
  const getAllPhotos = () => databaseRequest("readonly", (store) => store.getAll());

  async function loadUploadedPhotos() {
    try {
      const records = await getAllPhotos();
      uploadedMemories = records
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((record) => ({
          ...record,
          uploaded: true,
          src: URL.createObjectURL(record.blob),
          scene: null,
          number: "",
          title: record.caption || "我们收藏的这一刻",
          note: record.caption || "这一刻，被我好好收藏了。",
          date: new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(record.createdAt)),
        }));
    } catch (error) {
      console.warn("Could not load uploaded photos:", error);
    }

    uploadedMemories.forEach((memory, index) => {
      if (!memory.number) memory.number = pad(index + 1);
    });
    renderGallery();
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image could not be decoded"));
      };
      image.src = url;
    });
  }

  async function compressImage(file) {
    const maxSide = 1800;
    const image = await fileToImage(file);
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.84);
    });
    return blob || file;
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter(
      (file) => file.type.startsWith("image/") && file.size > 0,
    );
    if (!files.length) {
      showToast("没有找到可以放进星河的图片");
      return;
    }

    const uploadButton = $("#uploadButton");
    uploadButton.disabled = true;
    showToast(`正在收藏 ${files.length} 个心动瞬间...`);

    let added = 0;
    for (const file of files) {
      try {
        const blob = await compressImage(file);
        const createdAt = new Date().toISOString();
        const record = {
          id: `photo-${Date.now()}-${added}-${Math.random().toString(16).slice(2)}`,
          blob,
          createdAt,
          caption: "",
        };
        await putPhoto(record);
        const memory = {
          ...record,
          uploaded: true,
          src: URL.createObjectURL(blob),
          scene: null,
          number: pad(uploadedMemories.length + 1),
          title: "我们收藏的这一刻",
          note: "这一刻，被我好好收藏了。",
          date: new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(createdAt)),
        };
        uploadedMemories.push(memory);
        added += 1;
      } catch (error) {
        console.warn("Could not add photo:", error);
      }
    }

    uploadButton.disabled = false;
    $("#photoInput").value = "";
    renderGallery();
    showToast(added ? `已经有 ${added} 个瞬间住进我们的星河` : "照片没有成功打开，换一张试试");
  }

  function setupUploads() {
    const input = $("#photoInput");
    const uploadButton = $("#uploadButton");
    const section = $("#memories");
    const dropHint = $("#dropHint");
    let dragDepth = 0;

    uploadButton.addEventListener("click", () => input.click());
    input.addEventListener("change", () => handleFiles(input.files));

    section.addEventListener("dragenter", (event) => {
      if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
      event.preventDefault();
      dragDepth += 1;
      dropHint.classList.add("is-visible");
    });

    section.addEventListener("dragover", (event) => {
      if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });

    section.addEventListener("dragleave", () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) dropHint.classList.remove("is-visible");
    });

    section.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepth = 0;
      dropHint.classList.remove("is-visible");
      handleFiles(event.dataTransfer?.files);
    });

    document.addEventListener("dragover", (event) => event.preventDefault());
    document.addEventListener("drop", (event) => event.preventDefault());
  }

  function setupCaptionActions() {
    $("#saveCaptionButton").addEventListener("click", async () => {
      if (!currentMemory?.uploaded) return;
      const caption = $("#captionInput").value.trim().slice(0, 48);
      try {
        await putPhoto({
          id: currentMemory.id,
          blob: currentMemory.blob,
          createdAt: currentMemory.createdAt,
          caption,
        });
        currentMemory.caption = caption;
        currentMemory.title = caption || "我们收藏的这一刻";
        currentMemory.note = caption || "这一刻，被我好好收藏了。";
        $("#lightboxTitle").textContent = currentMemory.title;
        $("#lightboxNote").textContent = currentMemory.note;
        renderGallery();
        showToast("这句话，已经和照片放在一起");
      } catch (error) {
        console.warn("Could not save caption:", error);
        showToast("这句话暂时没有保存成功");
      }
    });

    $("#deletePhotoButton").addEventListener("click", async () => {
      if (!currentMemory?.uploaded) return;
      const shouldDelete = window.confirm("要把这张照片从我们的星河里移除吗？");
      if (!shouldDelete) return;

      try {
        await deletePhoto(currentMemory.id);
      } catch (error) {
        console.warn("Could not delete photo:", error);
      }

      URL.revokeObjectURL(currentMemory.src);
      uploadedMemories = uploadedMemories.filter((memory) => memory.id !== currentMemory.id);
      $("#lightbox").close();
      currentMemory = null;
      renderGallery();
      showToast("照片已从星河中移除");
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(dataURL) {
    const [metadata, encoded] = String(dataURL).split(",");
    if (!metadata.startsWith("data:image/") || !encoded) {
      throw new Error("Invalid photo data");
    }
    const mime = metadata.slice(5).split(";")[0];
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mime });
  }

  function setupMemorySync() {
    const dialog = $("#memorySyncDialog");
    const importButton = $("#importMemoriesButton");
    const importInput = $("#syncImportInput");
    const exportButton = $("#exportMemoriesButton");
    const status = $("#syncStatus");

    $("#memorySyncButton").addEventListener("click", () => {
      $("#syncPhotoCount").textContent = String(uploadedMemories.length);
      status.textContent = "照片与文字只会在你们之间传递。";
      openDialog(dialog);
    });

    exportButton.addEventListener("click", async () => {
      exportButton.disabled = true;
      status.textContent = "正在把照片和文字打包...";
      try {
        const records = await getAllPhotos().catch(() => []);
        const photos = [];
        for (const record of records) {
          photos.push({
            id: record.id,
            createdAt: record.createdAt,
            caption: record.caption || "",
            data: await blobToDataURL(record.blob),
          });
        }

        let wish = null;
        try {
          wish = JSON.parse(localStorage.getItem(WISH_KEY) || "null");
        } catch {
          wish = null;
        }

        const backup = {
          app: "lunaris-99-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          settings,
          wish,
          photos,
        };
        const date = toDateInputValue(new Date());
        const file = new File(
          [JSON.stringify(backup)],
          `给她的99号宇宙-回忆备份-${date}.json`,
          { type: "application/json" },
        );

        status.textContent = `已打包 ${photos.length} 张照片，正在打开分享...`;
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              title: "给她的99号宇宙",
              text: "这是我们共同的回忆备份。",
              files: [file],
            });
            status.textContent = "回忆文件已交给分享面板。";
            return;
          } catch (error) {
            if (error?.name === "AbortError") {
              status.textContent = "已取消分享，可以再点一次。";
              return;
            }
          }
        }

        const downloadUrl = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
        status.textContent = "回忆文件已下载，可以直接发给对方。";
      } catch (error) {
        console.warn("Could not export memories:", error);
        status.textContent = "导出没有完成，请再试一次。";
      } finally {
        exportButton.disabled = false;
      }
    });

    importButton.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      if (file.size > 80 * 1024 * 1024) {
        status.textContent = "这个回忆文件太大了，请减少照片数量。";
        importInput.value = "";
        return;
      }

      status.textContent = "正在把回忆接入这面照片墙...";
      importButton.disabled = true;
      try {
        const backup = JSON.parse(await file.text());
        if (backup?.app !== "lunaris-99-backup" || !Array.isArray(backup.photos)) {
          throw new Error("Unsupported backup");
        }

        if (backup.settings) {
          settings = {
            myName: String(backup.settings.myName || DEFAULT_SETTINGS.myName).slice(0, 12),
            girlName: String(backup.settings.girlName || DEFAULT_SETTINGS.girlName).slice(0, 12),
            anniversary: /^\d{4}-\d{2}-\d{2}$/.test(backup.settings.anniversary)
              ? backup.settings.anniversary
              : DEFAULT_SETTINGS.anniversary,
          };
          saveSettings();
          renderNames();
          updateTimeDisplay();
        }

        if (backup.wish?.wish) {
          try {
            localStorage.setItem(WISH_KEY, JSON.stringify(backup.wish));
            $("#wishInput").value = "";
            $("#wishSaved").textContent = `已经留在今夜星河里：${backup.wish.wish}`;
          } catch {
            // The photos can still be imported if local storage is unavailable.
          }
        }

        let imported = 0;
        for (const photo of backup.photos.slice(0, 30)) {
          try {
            const blob = dataURLToBlob(photo.data);
            await putPhoto({
              id: String(photo.id || `photo-import-${Date.now()}-${imported}`).slice(0, 200),
              blob,
              createdAt: photo.createdAt || new Date().toISOString(),
              caption: String(photo.caption || "").slice(0, 48),
            });
            imported += 1;
          } catch (error) {
            console.warn("Skipped one imported photo:", error);
          }
        }

        await loadUploadedPhotos();
        status.textContent = `导入完成，${imported} 张照片已经进入这面照片墙。`;
        showToast("我们的回忆，已经同步到这台设备");
      } catch (error) {
        console.warn("Could not import memories:", error);
        status.textContent = "这个文件不是有效的回忆备份，请确认后再试。";
      } finally {
        importButton.disabled = false;
        importInput.value = "";
      }
    });
  }

  function setupAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const button = $("#musicButton");
    const track = $("#backgroundAudio");
    const nowPlaying = $("#nowPlaying");
    let audioContext = null;
    let masterGain = null;
    if (!track) return;
    track.volume = 0.58;

    const updatePlaybackUI = () => {
      const isPlaying = !track.paused && !track.ended;
      button.classList.toggle("is-playing", isPlaying);
      button.setAttribute("aria-pressed", String(isPlaying));
      button.setAttribute(
        "aria-label",
        isPlaying ? "暂停 Tizzy T《99》背景音乐" : "播放 Tizzy T《99》背景音乐",
      );
      button.title = isPlaying ? "暂停 Tizzy T《99》" : "播放 Tizzy T《99》";
      nowPlaying.classList.toggle("is-visible", isPlaying);
    };

    const playTrack = async () => {
      try {
        await track.play();
      } catch (error) {
        console.warn("Could not play background track:", error);
        showToast("背景音乐没有成功播放，请再点一次");
      }
    };

    button.addEventListener("click", () => {
      if (track.paused) playTrack();
      else track.pause();
    });

    track.addEventListener("play", updatePlaybackUI);
    track.addEventListener("playing", () => {
      updatePlaybackUI();
      showToast("正在播放 · Tizzy T《99》");
    });
    track.addEventListener("waiting", () => {
      showToast("《99》正在加载，请稍候");
    });
    track.addEventListener("pause", updatePlaybackUI);
    track.addEventListener("ended", updatePlaybackUI);
    track.addEventListener("error", () => {
      showToast("没有找到背景音乐文件");
    });

    window.playLunarisTone = (frequency = 660) => {
      if (!AudioContextClass) return;
      if (!audioContext) {
        audioContext = new AudioContextClass();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.16;
        masterGain.connect(audioContext.destination);
      }
      if (audioContext.state === "suspended") audioContext.resume();
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      oscillator.connect(gain).connect(masterGain);
      oscillator.start(now);
      oscillator.stop(now + 0.4);
    };

    updatePlaybackUI();
  }

  function setupGame() {
    const stage = $("#gameStage");
    const canvas = $("#gameCanvas");
    const overlay = $("#gameOverlay");
    const startButton = $("#startGameButton");
    const restartButton = $("#restartGameButton");
    const timerLabel = $("#gameTimer");
    const catchLabel = $("#catchCount");
    const noteLabel = $("#caughtNote");
    const ctx = canvas.getContext("2d");
    if (!stage || !ctx) return;

    const TARGET = 8;
    const TOTAL_TIME = 45;
    const state = {
      mode: "idle",
      width: 0,
      height: 0,
      dpr: 1,
      timeLeft: TOTAL_TIME,
      caught: 0,
      stars: [],
      particles: [],
      spawnTimer: 0,
      elapsed: 0,
      noteTimer: 0,
      keys: new Set(),
      pointerActive: false,
    };

    const player = {
      x: 0,
      y: 0,
      radius: 18,
      targetX: 0,
      targetY: 0,
    };

    const starColors = ["#f2ddad", "#f09ba3", "#9fd7cf", "#f7e6cf"];

    function resizeGame() {
      const rect = stage.getBoundingClientRect();
      state.width = Math.max(1, rect.width);
      state.height = Math.max(1, rect.height);
      state.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(state.width * state.dpr);
      canvas.height = Math.round(state.height * state.dpr);
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      if (!player.x && !player.y) {
        player.x = state.width / 2;
        player.y = state.height * 0.76;
        player.targetX = player.x;
        player.targetY = player.y;
      }
      player.x = clamp(player.x, player.radius, state.width - player.radius);
      player.y = clamp(player.y, player.radius, state.height - player.radius);
    }

    function setOverlay(mode, title, text, buttonText, iconName) {
      overlay.classList.remove("is-hidden");
      overlay.querySelector(".overlay-kicker").textContent =
        mode === "won" ? "MISSION COMPLETE · 08 / 08" : "ORBITAL GAME · 01";
      $("#gameOverlayTitle").textContent = title;
      $("#gameOverlayText").textContent = text;
      startButton.innerHTML = `<i data-lucide="${iconName}"></i> ${buttonText}`;
      refreshIcons();
    }

    function resetGame() {
      state.mode = "running";
      state.timeLeft = TOTAL_TIME;
      state.caught = 0;
      state.stars = [];
      state.particles = [];
      state.spawnTimer = 0;
      state.elapsed = 0;
      player.x = state.width / 2;
      player.y = state.height * 0.76;
      player.targetX = player.x;
      player.targetY = player.y;
      catchLabel.textContent = `0 / ${TARGET}`;
      timerLabel.textContent = TOTAL_TIME.toFixed(1);
      overlay.classList.add("is-hidden");
      noteLabel.classList.remove("is-visible");
    }

    function startGame() {
      resizeGame();
      resetGame();
      if (window.playLunarisTone) window.playLunarisTone(523.25);
    }

    function endGame() {
      state.mode = "won";
      state.caught = TARGET;
      catchLabel.textContent = `${TARGET} / ${TARGET}`;
      setOverlay(
        "won",
        "你让我的小宇宙重新发光了",
        "八枚星愿全部归位。最后那一颗，是我偷偷藏给你的：往后余生，也请多多指教。",
        "再收集一次心动",
        "rotate-ccw",
      );
      burstCanvasParticles(state.width / 2, state.height / 2, 55);
      if (window.playLunarisTone) window.playLunarisTone(783.99);
    }

    function spawnStar() {
      const radius = 10 + Math.random() * 6;
      state.stars.push({
        x: radius + Math.random() * Math.max(1, state.width - radius * 2),
        y: -30,
        radius,
        vy: 55 + Math.random() * 45,
        sway: 15 + Math.random() * 28,
        swaySpeed: 1.2 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        rotation: Math.random() * Math.PI,
        caught: false,
      });
    }

    function starPath(context, spikes, outerRadius, innerRadius) {
      let rotation = -Math.PI / 2;
      const step = Math.PI / spikes;
      context.beginPath();
      context.moveTo(0, -outerRadius);
      for (let index = 0; index < spikes; index += 1) {
        context.lineTo(Math.cos(rotation) * outerRadius, Math.sin(rotation) * outerRadius);
        rotation += step;
        context.lineTo(Math.cos(rotation) * innerRadius, Math.sin(rotation) * innerRadius);
        rotation += step;
      }
      context.closePath();
    }

    function drawStarEntity(star) {
      const halo = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.radius * 3.2);
      halo.addColorStop(0, `${star.color}66`);
      halo.addColorStop(1, `${star.color}00`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius * 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.rotate(star.rotation);
      ctx.shadowColor = star.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = star.color;
      starPath(ctx, 5, star.radius, star.radius * 0.43);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.56;
      ctx.strokeStyle = star.color;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius * 1.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function drawPlayer() {
      ctx.save();
      const halo = ctx.createRadialGradient(
        player.x,
        player.y,
        0,
        player.x,
        player.y,
        player.radius * 3.2,
      );
      halo.addColorStop(0, "rgba(240, 155, 163, 0.26)");
      halo.addColorStop(1, "rgba(240, 155, 163, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius * 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(player.x, player.y);
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(242, 221, 173, 0.48)";
      ctx.beginPath();
      ctx.ellipse(0, 0, player.radius * 2.05, player.radius * 0.82, -0.36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const core = ctx.createRadialGradient(-4, -5, 1, 0, 0, player.radius);
      core.addColorStop(0, "#fff4dd");
      core.addColorStop(0.26, "#f1b0a9");
      core.addColorStop(0.68, "#bd6677");
      core.addColorStop(1, "#592e44");
      ctx.fillStyle = core;
      ctx.shadowColor = "rgba(240, 155, 163, 0.8)";
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function burstCanvasParticles(x, y, count) {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 18 + Math.random() * 70;
        state.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          size: 1 + Math.random() * 2.5,
          color: starColors[Math.floor(Math.random() * starColors.length)],
        });
      }
    }

    function showCaughtNote(index) {
      noteLabel.textContent = GAME_NOTES[index] || GAME_NOTES[GAME_NOTES.length - 1];
      noteLabel.classList.add("is-visible");
      window.clearTimeout(state.noteTimer);
      state.noteTimer = window.setTimeout(() => noteLabel.classList.remove("is-visible"), 1050);
    }

    function updateGame(delta) {
      state.elapsed += delta;
      if (state.mode !== "running") return;

      state.timeLeft = Math.max(0, state.timeLeft - delta);
      timerLabel.textContent = state.timeLeft.toFixed(1);

      if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) player.targetX -= 360 * delta;
      if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) player.targetX += 360 * delta;
      if (state.keys.has("ArrowUp") || state.keys.has("KeyW")) player.targetY -= 360 * delta;
      if (state.keys.has("ArrowDown") || state.keys.has("KeyS")) player.targetY += 360 * delta;

      player.targetX = clamp(player.targetX, player.radius, state.width - player.radius);
      player.targetY = clamp(player.targetY, player.radius, state.height - player.radius);
      player.x += (player.targetX - player.x) * Math.min(1, delta * 11);
      player.y += (player.targetY - player.y) * Math.min(1, delta * 11);

      state.spawnTimer -= delta;
      const activeStars = state.stars.filter((star) => !star.caught).length;
      if (state.spawnTimer <= 0 && activeStars < 5 && state.caught + activeStars < TARGET) {
        spawnStar();
        state.spawnTimer = 0.55 + Math.random() * 0.35;
      }

      state.stars.forEach((star) => {
        if (star.caught) return;
        star.y += star.vy * delta;
        star.x += Math.sin(state.elapsed * star.swaySpeed + star.phase) * star.sway * delta;
        star.rotation += delta * 0.5;

        const dx = star.x - player.x;
        const dy = star.y - player.y;
        const distance = Math.hypot(dx, dy);
        if (distance < player.radius + star.radius + 7) {
          star.caught = true;
          state.caught += 1;
          catchLabel.textContent = `${state.caught} / ${TARGET}`;
          showCaughtNote(state.caught - 1);
          burstCanvasParticles(star.x, star.y, 14);
          if (window.playLunarisTone) {
            window.playLunarisTone([523.25, 587.33, 659.25, 783.99, 880][state.caught % 5]);
          }
          if (state.caught >= TARGET) endGame();
        }
      });

      state.stars = state.stars.filter((star) => !star.caught && star.y < state.height + 45);

      if (state.timeLeft <= 0 && state.mode === "running") {
        state.stars = [];
        endGame();
      }
    }

    function drawBackground() {
      const gradient = ctx.createRadialGradient(
        state.width * 0.72,
        state.height * 0.18,
        2,
        state.width * 0.5,
        state.height * 0.5,
        Math.max(state.width, state.height) * 0.8,
      );
      gradient.addColorStop(0, "rgba(83, 54, 68, 0.26)");
      gradient.addColorStop(0.45, "rgba(17, 17, 27, 0.08)");
      gradient.addColorStop(1, "rgba(6, 8, 13, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, state.width, state.height);

      for (let index = 0; index < 58; index += 1) {
        const x = ((index * 131.7 + 19) % 997) / 997;
        const y = ((index * 73.3 + 11) % 991) / 991;
        const alpha = 0.13 + ((index * 7) % 20) / 100;
        ctx.fillStyle = `rgba(244, 234, 217, ${alpha})`;
        ctx.beginPath();
        ctx.arc(
          x * state.width,
          y * state.height,
          index % 5 === 0 ? 1.1 : 0.55,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      ctx.strokeStyle = "rgba(242, 221, 173, 0.045)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(
        state.width * 0.52,
        state.height * 0.55,
        state.width * 0.42,
        state.height * 0.25,
        -0.2,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }

    function drawParticles(delta) {
      state.particles.forEach((particle) => {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vx *= 0.985;
        particle.vy *= 0.985;
        particle.life -= delta * 1.4;
        if (particle.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      state.particles = state.particles.filter((particle) => particle.life > 0);
    }

    let lastFrame = 0;
    let gameFrameId = 0;

    function drawFrame(timestamp) {
      const delta = clamp((timestamp - lastFrame) / 1000 || 0, 0, 0.04);
      lastFrame = timestamp;
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.clearRect(0, 0, state.width, state.height);
      drawBackground();
      updateGame(delta);

      if (state.mode !== "idle") {
        drawPlayer();
        state.stars.forEach(drawStarEntity);
      } else {
        player.x = state.width * 0.5;
        player.y = state.height * 0.55 + Math.sin(timestamp / 1000) * 7;
        drawPlayer();
      }

      drawParticles(delta);
      gameFrameId = requestAnimationFrame(drawFrame);
    }

    const updatePointer = (event) => {
      if (state.mode !== "running") return;
      const rect = stage.getBoundingClientRect();
      player.targetX = clamp(event.clientX - rect.left, player.radius, state.width - player.radius);
      player.targetY = clamp(event.clientY - rect.top, player.radius, state.height - player.radius);
    };

    stage.addEventListener("pointerdown", (event) => {
      state.pointerActive = true;
      updatePointer(event);
    });
    stage.addEventListener("pointermove", (event) => {
      if (event.pointerType === "mouse" || state.pointerActive) updatePointer(event);
    });
    window.addEventListener("pointerup", () => {
      state.pointerActive = false;
    });

    window.addEventListener("keydown", (event) => {
      if (state.mode !== "running") return;
      if (event.target instanceof HTMLInputElement) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        state.keys.add(event.code);
        event.preventDefault();
      }
    });
    window.addEventListener("keyup", (event) => state.keys.delete(event.code));
    window.addEventListener("blur", () => state.keys.clear());

    startButton.addEventListener("click", startGame);
    restartButton.addEventListener("click", startGame);

    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(resizeGame) : null;
    if (resizeObserver) resizeObserver.observe(stage);
    window.addEventListener("resize", resizeGame);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(gameFrameId);
      } else {
        cancelAnimationFrame(gameFrameId);
        lastFrame = performance.now();
        gameFrameId = requestAnimationFrame(drawFrame);
      }
    });

    resizeGame();
    lastFrame = performance.now();
    gameFrameId = requestAnimationFrame(drawFrame);
  }

  function setupWish() {
    const form = $("#wishForm");
    const input = $("#wishInput");
    const output = $("#wishSaved");
    let savedWish = "";

    try {
      const parsed = JSON.parse(localStorage.getItem(WISH_KEY) || "null");
      savedWish = parsed?.wish || "";
    } catch {
      savedWish = "";
    }

    if (savedWish) {
      output.textContent = `已经留在今夜星河里：${savedWish}`;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const wish = input.value.trim().replace(/\s+/g, " ").slice(0, 80);
      if (!wish) {
        showToast("先写下一句属于你们的悄悄话吧");
        input.focus();
        return;
      }

      try {
        localStorage.setItem(
          WISH_KEY,
          JSON.stringify({ wish, savedAt: new Date().toISOString() }),
        );
      } catch (error) {
        console.warn("Could not save wish:", error);
      }

      output.textContent = `已经留在今夜星河里：${wish}`;
      input.value = "";
      const rect = form.getBoundingClientRect();
      burstHearts(rect.left + rect.width - 22, rect.top + rect.height / 2, 9);
      showToast("星愿已收好，等未来替我们拆开");
    });
  }

  function burstHearts(clientX, clientY, count = 7) {
    const sourceHeart = document.querySelector("svg.lucide-heart");
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("span");
      particle.className = "heart-particle";
      const drift = Math.round((Math.random() - 0.5) * 120);
      const rotate = Math.round((Math.random() - 0.5) * 70);
      particle.style.left = `${clientX + (Math.random() - 0.5) * 25}px`;
      particle.style.top = `${clientY + (Math.random() - 0.5) * 18}px`;
      particle.style.setProperty("--drift", `${drift}px`);
      particle.style.setProperty("--rotate", `${rotate}deg`);
      particle.style.animationDelay = `${Math.random() * 0.12}s`;

      if (sourceHeart) {
        const clone = sourceHeart.cloneNode(true);
        particle.appendChild(clone);
      } else {
        particle.textContent = "✦";
      }
      document.body.appendChild(particle);
      window.setTimeout(() => particle.remove(), 1800);
    }
  }

  function setupSecrets() {
    $("#secretStarButton").addEventListener("click", () => {
      openDialog($("#surpriseDialog"));
    });

    let titleClicks = 0;
    let titleTimer = 0;
    $("#heroTitle").addEventListener("click", () => {
      titleClicks += 1;
      window.clearTimeout(titleTimer);
      titleTimer = window.setTimeout(() => {
        titleClicks = 0;
      }, 900);
      if (titleClicks >= 3) {
        titleClicks = 0;
        openDialog($("#surpriseDialog"));
      }
    });
  }

  function init() {
    refreshIcons();
    renderNames();
    updateTimeDisplay();
    updateDailyLove();
    updateLetterDate();
    renderGallery();
    setupReveal();
    setupHeaderAndNav();
    setupSkyCanvas();
    setupPointerHalo();
    setupSettings();
    setupDialogs();
    setupPlanetInteraction();
    setupMemoryGrid();
    setupUploads();
    setupCaptionActions();
    setupMemorySync();
    setupAudio();
    setupGame();
    setupWish();
    setupSecrets();
    loadUploadedPhotos();

    window.setInterval(updateTimeDisplay, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

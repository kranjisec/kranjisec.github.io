/* Code to Class — interface and school-route animation. */
(function () {
  "use strict";

  const STORAGE_KEY = "code-to-class-v1";
  const LEVELS = window.LEVELS;
  const Engine = window.Engine;
  const $ = (selector, parent) => (parent || document).querySelector(selector);
  const $$ = (selector, parent) => Array.from((parent || document).querySelectorAll(selector));

  const els = {
    chapterPill: $("#chapterPill"),
    progressText: $("#progressText"),
    progressBar: $("#progressBar"),
    missionsBtn: $("#missionsBtn"),
    guideBtn: $("#guideBtn"),
    guideBtn2: $("#guideBtn2"),
    brandBtn: $("#brandBtn"),
    missionChapter: $("#missionChapter"),
    missionIndex: $("#missionIndex"),
    missionTitle: $("#missionTitle"),
    missionIntro: $("#missionIntro"),
    conceptTitle: $("#conceptTitle"),
    conceptDescription: $("#conceptDescription"),
    conceptSnippet: $("#conceptSnippet"),
    hintBtn: $("#hintBtn"),
    hintBody: $("#hintBody"),
    hintText: $("#hintText"),
    fieldName: $("#fieldName"),
    schoolChip: $("#schoolChip"),
    schoolStat: $("#schoolStat"),
    goalSchool: $("#goalSchool"),
    goalSchoolCount: $("#goalSchoolCount"),
    prevBtn: $("#prevBtn"),
    nextBtn: $("#nextBtn"),
    board: $("#board"),
    boardGrid: $("#boardGrid"),
    milo: $("#milo"),
    miloRotor: $("#miloRotor"),
    effects: $("#effects"),
    speechBubble: $("#speechBubble"),
    runStatus: $("#runStatus"),
    statusWrap: $(".run-status"),
    speedButtons: $$(".speed-switch button"),
    editor: $("#editor"),
    highlight: $("#highlight"),
    highlightCode: $("#highlight code"),
    lineNumbers: $("#lineNumbers"),
    saveNote: $("#saveNote"),
    runBtn: $("#runBtn"),
    resetBtn: $("#resetBtn"),
    starterBtn: $("#starterBtn"),
    consoleBody: $("#consoleBody"),
    consoleStatus: $("#consoleStatus"),
    missionsModal: $("#missionsModal"),
    missionsList: $("#missionsList"),
    missionsProgress: $("#missionsProgress"),
    resetProgressBtn: $("#resetProgressBtn"),
    guideModal: $("#guideModal"),
    successModal: $("#successModal"),
    successEyebrow: $("#successEyebrow"),
    successTitle: $("#successTitle"),
    successText: $("#successText"),
    successBlocks: $("#successBlocks"),
    successActions: $("#successActions"),
    successConcept: $("#successConcept"),
    successNextBtn: $("#successNextBtn"),
    successStayBtn: $("#successStayBtn"),
    successFootnote: $("#successFootnote"),
    confetti: $("#confetti"),
    toast: $("#toast")
  };

  const state = {
    levelIndex: 0,
    completed: new Set(),
    codes: {},
    speed: 1.3,
    running: false,
    runToken: 0,
    activeModal: null,
    lastFocused: null,
    hintOpen: false,
    saveTimer: null,
    toastTimer: null,
    speechTimer: null,
    hasRendered: false
  };

  const visual = {
    x: 0,
    y: 0,
    dir: 1,
    atGoal: false
  };

  let cells = new Map();
  let goalCell = null;

  const HIGHLIGHT_KEYWORDS = new Set(Array.from(Engine.KEYWORDS));
  const HIGHLIGHT_BUILTINS = new Set(Array.from(Engine.GAME_COMMANDS).concat(Array.from(Engine.LANGUAGE_FUNCTIONS)));

  const ICONS = {
    play: "i-play",
    stop: "i-stop",
    reset: "i-reset",
    arrow: "i-arrow-right",
    check: "i-check"
  };

  function icon(name, className) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"' +
      (className ? ' class="' + className + '"' : "") + '><use href="#' +
      (ICONS[name] || name) + '"></use></svg>';
  }

  /* ------------------------------------------------------------------ */
  /* Persistence                                                        */
  /* ------------------------------------------------------------------ */

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.completed)) {
        const valid = new Set(LEVELS.map((level) => level.id));
        saved.completed.forEach((id) => {
          if (valid.has(id)) state.completed.add(id);
        });
      }
      if (saved.codes && typeof saved.codes === "object") {
        Object.keys(saved.codes).forEach((id) => {
          if (typeof saved.codes[id] === "string") state.codes[id] = saved.codes[id];
        });
      }
      if (Number.isInteger(saved.current) && saved.current >= 0 && saved.current < LEVELS.length) {
        state.levelIndex = saved.current;
      }
      if (typeof saved.speed === "number" && [1.3, 0.78, 0.45].includes(saved.speed)) {
        state.speed = saved.speed;
      }
    } catch (error) {
      /* A full or blocked storage should never stop the school run. */
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        completed: Array.from(state.completed),
        codes: state.codes,
        current: state.levelIndex,
        speed: state.speed
      }));
    } catch (error) {
      /* Ignore private-mode storage failures. */
    }
  }

  function saveCodeNow() {
    if (!LEVELS[state.levelIndex]) return;
    const level = LEVELS[state.levelIndex];
    state.codes[level.id] = els.editor.value;
    persist();
    els.saveNote.textContent = "saved locally";
    els.saveNote.classList.remove("is-saving");
  }

  function scheduleSave() {
    els.saveNote.textContent = "saving…";
    els.saveNote.classList.add("is-saving");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveCodeNow, 420);
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                               */
  /* ------------------------------------------------------------------ */

  loadSaved();
  bindEvents();
  applySpeed(state.speed, false);
  renderLevel(state.levelIndex, { focusEditor: false });
  updateProgress();
  updateMissionsModal();

  function bindEvents() {
    els.runBtn.addEventListener("click", runCode);
    els.resetBtn.addEventListener("click", () => resetField({ clearLog: true }));
    els.starterBtn.addEventListener("click", restoreStarter);
    els.prevBtn.addEventListener("click", () => moveLevel(-1));
    els.nextBtn.addEventListener("click", () => moveLevel(1));
    els.missionsBtn.addEventListener("click", () => openModal("missionsModal"));
    els.guideBtn.addEventListener("click", () => openModal("guideModal"));
    els.guideBtn2.addEventListener("click", () => openModal("guideModal"));
    els.brandBtn.addEventListener("click", () => {
      if (state.levelIndex !== 0) renderLevel(0, { focusEditor: true });
    });
    els.hintBtn.addEventListener("click", toggleHint);
    els.editor.addEventListener("input", onEditorInput);
    els.editor.addEventListener("scroll", syncEditorScroll);
    els.editor.addEventListener("keydown", onEditorKeyDown);
    els.speedButtons.forEach((button) => {
      button.addEventListener("click", () => applySpeed(Number(button.dataset.speed), true));
    });
    els.successNextBtn.addEventListener("click", () => {
      closeModal();
      if (state.levelIndex < LEVELS.length - 1) {
        renderLevel(state.levelIndex + 1, { focusEditor: true });
      } else {
        openModal("missionsModal");
      }
    });
    els.successStayBtn.addEventListener("click", () => {
      closeModal();
      els.editor.focus();
    });
    els.resetProgressBtn.addEventListener("click", resetProgress);

    $$("[data-close]").forEach((element) => {
      element.addEventListener("click", () => closeModal(element.dataset.close));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.activeModal) {
        closeModal();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        const tag = document.activeElement && document.activeElement.tagName;
        if (state.activeModal) return;
        event.preventDefault();
        runCode();
      }
    });

    window.addEventListener("beforeunload", saveCodeNow);
  }

  /* ------------------------------------------------------------------ */
  /* Mission rendering                                                  */
  /* ------------------------------------------------------------------ */

  function renderLevel(index, options) {
    const opts = options || {};
    const nextIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    if (state.hasRendered) saveCodeNow();
    stopRun(true);
    state.levelIndex = nextIndex;
    const level = LEVELS[nextIndex];

    state.hintOpen = false;
    els.hintBody.hidden = true;
    els.hintBtn.setAttribute("aria-expanded", "false");
    els.hintText.textContent = level.hint;

    els.missionChapter.textContent = "The school run";
    els.missionIndex.textContent = "Lesson " + String(level.number).padStart(2, "0") + " of 03";
    els.missionTitle.textContent = level.title;
    els.missionIntro.textContent = level.intro;
    els.conceptTitle.textContent = level.concept;
    els.conceptDescription.textContent = level.conceptDescription;
    els.conceptSnippet.textContent = level.conceptSnippet;
    els.fieldName.textContent = level.field;
    els.chapterPill.textContent = "The School Run · 3 lessons";

    els.prevBtn.disabled = nextIndex === 0;
    els.nextBtn.disabled = nextIndex === LEVELS.length - 1;
    els.prevBtn.querySelector("span").textContent = nextIndex === 0 ? "Start" : "Back";
    els.nextBtn.querySelector("span").textContent = nextIndex === LEVELS.length - 1 ? "Last lesson" : "Next";

    const hasSavedCode = Object.prototype.hasOwnProperty.call(state.codes, level.id);
    els.editor.value = hasSavedCode ? state.codes[level.id] : level.starter;
    updateEditor();
    els.editor.scrollTop = 0;
    syncEditorScroll();
    markErrorLine(null);
    persist();

    buildBoard(level);
    resetVisual(level);
    updateSchoolStatus(level.start.x, level.start.y, false);
    updateRunStatus("Ready to run", "idle");
    setConsoleStatus("ready", "");
    clearConsole();
    addConsole("You are on " + level.field + ". Press Run when you are ready.", "muted");
    setRunButton(false);
    document.title = level.title + " · Code to School";
    updateProgress();
    updateMissionsModal();
    state.hasRendered = true;

    if (opts.focusEditor) {
      window.setTimeout(() => els.editor.focus(), 60);
    }
  }

  function moveLevel(direction) {
    const target = state.levelIndex + direction;
    if (target < 0 || target >= LEVELS.length) return;
    renderLevel(target, { focusEditor: true });
  }

  function toggleHint() {
    state.hintOpen = !state.hintOpen;
    els.hintBtn.setAttribute("aria-expanded", String(state.hintOpen));
    els.hintBody.hidden = !state.hintOpen;
    if (state.hintOpen) {
      els.hintBody.style.animation = "none";
      void els.hintBody.offsetWidth;
      els.hintBody.style.animation = "";
    }
  }

  function restoreStarter() {
    if (state.running) stopRun(false);
    const level = LEVELS[state.levelIndex];
    if (els.editor.value !== level.starter) {
      const ok = window.confirm("Replace your current code with the starter code for this lesson?");
      if (!ok) return;
    }
    els.editor.value = level.starter;
    updateEditor();
    state.codes[level.id] = level.starter;
    persist();
    els.saveNote.textContent = "starter restored";
    showToast("Starter code restored");
    els.editor.focus();
  }

  /* ------------------------------------------------------------------ */
  /* Board construction                                                 */
  /* ------------------------------------------------------------------ */

  function paint(seed, x, y) {
    let n = (x * 374761393 + y * 668265263 + seed * 69069) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function propMarkup(type, variation) {
    const drawings = {
      tree:
        '<svg viewBox="0 0 44 56" aria-hidden="true">' +
        '<ellipse cx="22" cy="51" rx="11" ry="3" fill="rgba(35,75,42,.16)"/>' +
        '<rect x="19.5" y="30" width="5" height="20" rx="2.4" fill="#8a6041"/>' +
        '<circle cx="22" cy="22" r="15" fill="#60925e"/>' +
        '<circle cx="12" cy="27" r="9" fill="#52854f"/>' +
        '<circle cx="32" cy="27" r="10" fill="#6c9d66"/>' +
        '<circle cx="22" cy="13" r="9" fill="#77aa6f"/>' +
        '<path d="M15 19c2-5 7-8 12-7" fill="none" stroke="#a8cb8e" stroke-width="2.2" stroke-linecap="round" opacity=".72"/>' +
        '</svg>',
      bush:
        '<svg viewBox="0 0 44 28" aria-hidden="true">' +
        '<ellipse cx="22" cy="25" rx="15" ry="2.5" fill="rgba(35,75,42,.13)"/>' +
        '<circle cx="13" cy="18" r="8" fill="#619362"/>' +
        '<circle cx="25" cy="15" r="10" fill="#75a66d"/>' +
        '<circle cx="35" cy="19" r="7" fill="#568b58"/>' +
        '<path d="M18 11c2-3 5-4 8-3" fill="none" stroke="#b0d197" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>' +
        '</svg>',
      lamp:
        '<svg viewBox="0 0 28 62" aria-hidden="true">' +
        '<ellipse cx="14" cy="59" rx="8" ry="2.2" fill="rgba(35,75,42,.16)"/>' +
        '<rect x="12.2" y="18" width="3.6" height="41" rx="1.8" fill="#4b6470"/>' +
        '<path d="M14 19V8" fill="none" stroke="#4b6470" stroke-width="3.6" stroke-linecap="round"/>' +
        '<path d="M7.5 9h13l-2.2 8H9.7L7.5 9Z" fill="#f4c55f" stroke="#4b6470" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M4.5 20h19" fill="none" stroke="#4b6470" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="14" cy="13" r="6.8" fill="#ffe9a4" opacity=".26"/>' +
        '</svg>',
      bench:
        '<svg viewBox="0 0 46 30" aria-hidden="true">' +
        '<ellipse cx="23" cy="27" rx="17" ry="2.4" fill="rgba(35,75,42,.14)"/>' +
        '<rect x="7" y="10" width="32" height="6" rx="2.5" fill="#bd8050"/>' +
        '<rect x="5" y="16" width="36" height="4.5" rx="2.2" fill="#a96e43"/>' +
        '<path d="M10 20v6M36 20v6" stroke="#546d73" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M9 13h28" stroke="#dca475" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>' +
        '</svg>'
    };
    return '<span class="prop prop-' + type + '" style="--ps:' + variation + '">' +
      drawings[type] + "</span>";
  }

  function schoolMarkup() {
    return '<span class="school-token">' +
      '<img src="./assets/school.png" width="80" height="60">'
      '</span>';
  }

  function buildBoard(level) {
    els.board.style.setProperty("--cols", level.size.w);
    els.board.style.setProperty("--rows", level.size.h);
    els.boardGrid.innerHTML = "";
    cells = new Map();
    goalCell = null;

    const pathKeys = new Set((level.path || []).map(([x, y]) => x + "," + y));
    const tones = ["#b8d5a4", "#b2d19d", "#bedaa9", "#b5d3a0"];
    const fragment = document.createDocumentFragment();

    for (let y = 0; y < level.size.h; y += 1) {
      for (let x = 0; x < level.size.w; x += 1) {
        const key = x + "," + y;
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.style.setProperty("--cell-bg", tones[(x * 3 + y * 5 + level.number) % tones.length]);

        const isGoal = level.goal.x === x && level.goal.y === y;
        const isStart = level.start.x === x && level.start.y === y;
        const isPath = pathKeys.has(key);
        let inner = "";

        if (isPath) cell.classList.add("sidewalk");
        if (isStart) cell.classList.add("start");

        if (isGoal) {
          cell.classList.add("goal");
          goalCell = cell;
          inner += schoolMarkup();
        } else if (!isPath && !isStart) {
          const roll = paint(level.number * 17 + 3, x, y);
          if (roll > 0.76) {
            inner += propMarkup("tree", (0.86 + paint(level.number + 11, x, y) * 0.22).toFixed(2));
          } else if (roll > 0.61) {
            inner += propMarkup("bush", (0.86 + paint(level.number + 4, x, y) * 0.2).toFixed(2));
          } else if (roll > 0.49) {
            inner += propMarkup("bench", (0.86 + paint(level.number + 6, x, y) * 0.18).toFixed(2));
          } else if (roll > 0.39) {
            inner += propMarkup("lamp", "0.9");
          } else {
            const kind = roll > 0.25 ? "flower" : "tuft";
            inner += '<span class="flora flora-' + kind + '" style="--fx:' +
              Math.round(17 + paint(level.number, x, y) * 68) + "%;--fy:" +
              Math.round(18 + paint(level.number + 2, x, y) * 58) + '%"></span>';
          }
        }

        cell.innerHTML = inner;
        cells.set(key, cell);
        fragment.appendChild(cell);
      }
    }

    els.boardGrid.appendChild(fragment);
    positionMilo(level.start.x, level.start.y, level.start.dir, false);
    els.speechBubble.hidden = true;
    els.effects.innerHTML = "";
  }

  function resetVisual(level) {
    visual.x = level.start.x;
    visual.y = level.start.y;
    visual.dir = level.start.dir;
    visual.atGoal = false;
  }

  function positionMilo(x, y, dir, animate) {
    if (!animate) els.milo.classList.add("no-transition");
    const level = LEVELS[state.levelIndex];
    els.milo.style.left = (((x + 0.5) / level.size.w) * 100) + "%";
    els.milo.style.top = (((y + 0.5) / level.size.h) * 100) + "%";
    els.miloRotor.style.transform = "rotate(" + dir * 90 + "deg)";
    if (!animate) {
      void els.milo.offsetWidth;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => els.milo.classList.remove("no-transition"));
      });
    }
  }

  function updateSchoolStatus(x, y, arrived) {
    const level = LEVELS[state.levelIndex];
    const distance = Math.abs(x - level.goal.x) + Math.abs(y - level.goal.y);
    const blocks = distance + (distance === 1 ? " block" : " blocks");

    els.schoolStat.textContent = arrived ? "Arrived" : blocks;
    els.goalSchoolCount.textContent = arrived ? "Arrived" : distance + " to go";
    els.schoolChip.classList.toggle("is-ready", arrived);
    els.goalSchool.classList.toggle("is-done", arrived);
    if (goalCell) goalCell.classList.toggle("is-arrived", arrived);
    visual.atGoal = arrived;
  }

  function updateEditor() {
    const value = els.editor.value;
    els.highlightCode.innerHTML = highlightPython(value);
    const lineCount = Math.max(1, value.split("\n").length);
    let numbers = "";
    for (let i = 1; i <= lineCount; i += 1) {
      numbers += "<span>" + i + "</span>";
    }
    els.lineNumbers.innerHTML = numbers;
    syncEditorScroll();
  }

  function syncEditorScroll() {
    els.highlight.scrollTop = els.editor.scrollTop;
    els.highlight.scrollLeft = els.editor.scrollLeft;
    els.lineNumbers.style.transform = "translateY(" + (-els.editor.scrollTop) + "px)";
  }

  function markErrorLine(line) {
    $$(".line-numbers span", els.lineNumbers).forEach((span, index) => {
      span.classList.toggle("is-error-line", line !== null && index + 1 === line);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Running and animating                                              */
  /* ------------------------------------------------------------------ */

  function runCode() {
    if (state.running) {
      stopRun(false);
      addConsole("Run stopped.", "muted");
      return;
    }

    saveCodeNow();
    if (state.activeModal) closeModal();
    resetField({ clearLog: false, silent: true });

    const level = LEVELS[state.levelIndex];
    const source = els.editor.value;
    clearConsole();
    markErrorLine(null);

    if (!source.trim()) {
      setConsoleStatus("error", "error");
      updateRunStatus("Nothing to run yet", "error");
      addConsole("Your file is empty. Add a command, like move_forward().", "error");
      return;
    }

    addConsole("Running main.py…", "muted");
    const result = Engine.run(source, level);

    if (result.error && result.error.stage === "parse") {
      setConsoleStatus("error", "error");
      updateRunStatus("A little syntax snag", "error");
      addConsole(result.error.message, "error", result.error.line);
      markErrorLine(result.error.line);
      return;
    }

    state.runToken += 1;
    state.running = true;
    setRunButton(true);
    els.editor.readOnly = true;
    setConsoleStatus("running", "running");
    updateRunStatus("You are on the move", "running");
    playTrace(result, state.runToken);
  }

  async function playTrace(result, token) {
    const level = LEVELS[state.levelIndex];

    for (const event of result.events) {
      if (token !== state.runToken) return;

      if (event.type === "move") {
        visual.x = event.pos[0];
        visual.y = event.pos[1];
        visual.dir = event.dir;
        const arrived = visual.x === level.goal.x && visual.y === level.goal.y;
        positionMilo(visual.x, visual.y, visual.dir, true);
        updateSchoolStatus(visual.x, visual.y, arrived);
        if (!(await wait(210 * state.speed, token))) return;
        continue;
      }

      if (event.type === "turn") {
        visual.dir = event.dir;
        positionMilo(visual.x, visual.y, visual.dir, true);
        if (!(await wait(145 * state.speed, token))) return;
        continue;
      }

      if (event.type === "log") {
        addConsole(event.text, event.tone === "warn" ? "warn" : "muted");
        if (!(await wait(115 * state.speed, token))) return;
        continue;
      }

      if (event.type === "say") {
        addConsole("Milo says: “" + event.text + "”", "say");
        showSpeech(event.text);
        if (!(await wait(310 * state.speed, token))) return;
        continue;
      }

      if (event.type === "print") {
        addConsole(event.text, "print");
        if (!(await wait(75 * state.speed, token))) return;
        continue;
      }

      if (event.type === "bump") {
        bumpMilo();
        if (!(await wait(330 * state.speed, token))) return;
        continue;
      }

      if (event.type === "error") {
        addConsole(event.message, "error", event.line);
        markErrorLine(event.line);
        setConsoleStatus("error", "error");
        if (!(await wait(180 * state.speed, token))) return;
        continue;
      }

      if (event.type === "complete") {
        updateSchoolStatus(level.goal.x, level.goal.y, true);
        addConsole("You made it through the school gates.", "success");
        if (!(await wait(300 * state.speed, token))) return;
      }
    }

    if (token !== state.runToken) return;
    finishRun(result);
  }

  function wait(milliseconds, token) {
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(token === state.runToken), Math.max(0, milliseconds));
    });
  }

  function stopRun(silent) {
    state.runToken += 1;
    state.running = false;
    els.editor.readOnly = false;
    setRunButton(false);
    if (!silent) {
      updateRunStatus("Stopped", "idle");
      setConsoleStatus("stopped", "");
    }
  }

  function resetField(options) {
    const opts = options || {};
    stopRun(true);
    const level = LEVELS[state.levelIndex];
    buildBoard(level);
    resetVisual(level);
    els.milo.classList.remove("bump", "celebrate");
    updateSchoolStatus(level.start.x, level.start.y, false);
    markErrorLine(null);
    updateRunStatus("Ready to run", "idle");
    setConsoleStatus("ready", "");
    if (opts.clearLog) {
      clearConsole();
      addConsole("Route reset. You are back at the start.", "muted");
    }
  }

  function finishRun(result) {
    state.running = false;
    els.editor.readOnly = false;
    setRunButton(false);
    const level = LEVELS[state.levelIndex];

    if (result.completed) {
      updateRunStatus("School reached", "success");
      setConsoleStatus("success", "success");
      updateSchoolStatus(level.goal.x, level.goal.y, true);
      state.completed.add(level.id);
      persist();
      updateProgress();
      updateMissionsModal();
      markErrorLine(null);
      els.milo.classList.add("celebrate");
      window.setTimeout(() => els.milo.classList.remove("celebrate"), 800);

      const token = state.runToken;
      window.setTimeout(() => {
        if (token === state.runToken && !state.activeModal) {
          showSuccess(result, level);
        }
      }, 620);
      return;
    }

    if (result.error) {
      updateRunStatus("Your character needs a tweak", "error");
      setConsoleStatus("error", "error");
      markErrorLine(result.error.line);
      return;
    }

    updateRunStatus("Program finished", "idle");
    setConsoleStatus("idle", "");
    const distance = Math.abs(visual.x - level.goal.x) + Math.abs(visual.y - level.goal.y);
    addConsole(
      "You stopped " + distance + (distance === 1 ? " block" : " blocks") +
        " from school. Add a few more steps to the route.",
      "warn"
    );
  }

  function setRunButton(running) {
    els.runBtn.classList.toggle("is-running", running);
    els.runBtn.innerHTML = running
      ? icon("stop") + "<span>Stop</span>"
      : icon("play") + "<span>Run code</span><kbd>⌘↵</kbd>";
    els.runBtn.setAttribute("aria-label", running ? "Stop running code" : "Run code");
  }

  function updateRunStatus(text, mode) {
    els.runStatus.textContent = text;
    els.statusWrap.className = "run-status" + (mode && mode !== "idle" ? " is-" + mode : "");
  }

  function setConsoleStatus(text, mode) {
    els.consoleStatus.textContent = text;
    els.consoleStatus.className = "console-status" + (mode ? " is-" + mode : "");
  }

  /* ------------------------------------------------------------------ */
  /* Board animation                                                    */
  /* ------------------------------------------------------------------ */

  function bumpMilo() {
    els.milo.classList.remove("bump");
    void els.milo.offsetWidth;
    els.milo.classList.add("bump");
    window.setTimeout(() => els.milo.classList.remove("bump"), 420);
  }

  function showSpeech(text) {
    const level = LEVELS[state.levelIndex];
    clearTimeout(state.speechTimer);
    const left = ((visual.x + 0.5) / level.size.w) * 100;
    const above = visual.y > 0;
    const top = ((visual.y + (above ? 0.5 : 1.35)) / level.size.h) * 100;
    els.speechBubble.textContent = text.length > 90 ? text.slice(0, 87) + "…" : text;
    els.speechBubble.style.left = left + "%";
    els.speechBubble.style.top = top + "%";
    els.speechBubble.hidden = false;
    els.speechBubble.style.animation = "none";
    void els.speechBubble.offsetWidth;
    els.speechBubble.style.animation = "";
    state.speechTimer = window.setTimeout(() => {
      els.speechBubble.hidden = true;
    }, 1650);
  }

  /* ------------------------------------------------------------------ */
  /* Editor behavior and syntax color                                   */
  /* ------------------------------------------------------------------ */

  function onEditorInput() {
    updateEditor();
    markErrorLine(null);
    scheduleSave();
    if (!state.running) {
      updateRunStatus("Ready to run", "idle");
      setConsoleStatus("ready", "");
    }
  }

  function onEditorKeyDown(event) {
    if (state.running) return;
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        dedentSelection();
      } else if (els.editor.selectionStart !== els.editor.selectionEnd) {
        indentSelection();
      } else {
        insertEditorText("    ", null);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const value = els.editor.value;
      const start = els.editor.selectionStart;
      const end = els.editor.selectionEnd;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const currentLine = value.slice(lineStart, start);
      const indent = currentLine.match(/^ */)[0];
      const trimmed = currentLine.trimEnd();
      const extra = trimmed.endsWith(":") ? "    " : "";
      insertEditorText("\n" + indent + extra, null);
    }
  }

  function insertEditorText(text, selection) {
    const start = els.editor.selectionStart;
    const end = els.editor.selectionEnd;
    els.editor.setRangeText(text, start, end, "end");
    updateEditor();
    scheduleSave();
    markErrorLine(null);
    if (selection) {
      els.editor.selectionStart = start + selection[0];
      els.editor.selectionEnd = start + selection[1];
    }
  }

  function indentSelection() {
    const value = els.editor.value;
    const selectionStart = els.editor.selectionStart;
    const selectionEnd = els.editor.selectionEnd;
    const firstLineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const lastLineStart = value.lastIndexOf("\n", Math.max(selectionStart, selectionEnd - 1)) + 1;
    const nextBreak = value.indexOf("\n", selectionEnd);
    const blockEnd = nextBreak === -1 ? value.length : nextBreak;
    const block = value.slice(firstLineStart, blockEnd);
    const indented = block.split("\n").map((line) => "    " + line).join("\n");
    els.editor.setSelectionRange(firstLineStart, blockEnd);
    els.editor.setRangeText(indented, firstLineStart, blockEnd, "select");
    updateEditor();
    scheduleSave();
    markErrorLine(null);
    els.editor.selectionStart = selectionStart + 4;
    els.editor.selectionEnd = selectionEnd + (indented.length - block.length);
    if (lastLineStart < firstLineStart) {
      els.editor.selectionStart = firstLineStart;
    }
  }

  function dedentSelection() {
    const value = els.editor.value;
    const selectionStart = els.editor.selectionStart;
    const selectionEnd = els.editor.selectionEnd;
    const firstLineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const lastLineEnd = selectionEnd === selectionStart
      ? value.indexOf("\n", selectionEnd) === -1 ? value.length : value.indexOf("\n", selectionEnd)
      : selectionEnd;
    const block = value.slice(firstLineStart, lastLineEnd);
    const lines = block.split("\n");
    let removed = 0;
    const dedented = lines.map((line) => {
      const match = line.match(/^ {1,4}/);
      if (!match) return line;
      removed += match[0].length;
      return line.slice(match[0].length);
    }).join("\n");
    if (!removed) return;

    els.editor.setSelectionRange(firstLineStart, lastLineEnd);
    els.editor.setRangeText(dedented, firstLineStart, lastLineEnd, "select");
    updateEditor();
    scheduleSave();
    markErrorLine(null);
    const shift = Math.min(removed, selectionStart - firstLineStart);
    els.editor.selectionStart = Math.max(firstLineStart, selectionStart - shift);
    els.editor.selectionEnd = Math.max(els.editor.selectionStart, selectionEnd - removed);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function highlightPython(source) {
    let result = "";
    let i = 0;
    let afterDef = false;

    while (i < source.length) {
      const ch = source[i];

      if (ch === "#") {
        const end = source.indexOf("\n", i);
        const stop = end === -1 ? source.length : end;
        result += '<span class="tok-com">' + escapeHtml(source.slice(i, stop)) + "</span>";
        i = stop;
        continue;
      }

      if (ch === '"' || ch === "'") {
        const quote = ch;
        const start = i;
        i += 1;
        let escaped = false;
        while (i < source.length) {
          const current = source[i];
          if (escaped) {
            escaped = false;
          } else if (current === "\\") {
            escaped = true;
          } else if (current === quote) {
            i += 1;
            break;
          }
          i += 1;
        }
        result += '<span class="tok-str">' + escapeHtml(source.slice(start, i)) + "</span>";
        continue;
      }

      if (/[0-9]/.test(ch)) {
        const start = i;
        while (i < source.length && /[0-9]/.test(source[i])) i += 1;
        if (source[i] === "." && /[0-9]/.test(source[i + 1] || "")) {
          i += 1;
          while (i < source.length && /[0-9]/.test(source[i])) i += 1;
        }
        result += '<span class="tok-num">' + source.slice(start, i) + "</span>";
        continue;
      }

      if (/[A-Za-z_]/.test(ch)) {
        const start = i;
        while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i += 1;
        const word = source.slice(start, i);
        const rest = source.slice(i);
        const isCall = /^\s*\(/.test(rest);
        let className = "";

        if (HIGHLIGHT_KEYWORDS.has(word)) {
          className = word === "True" || word === "False" || word === "None" ? "tok-bool" : "tok-kw";
        } else if (afterDef) {
          className = "tok-fn";
        } else if (HIGHLIGHT_BUILTINS.has(word)) {
          className = "tok-bi";
        } else if (isCall) {
          className = "tok-fn";
        }

        result += className
          ? '<span class="' + className + '">' + escapeHtml(word) + "</span>"
          : escapeHtml(word);
        afterDef = word === "def";
        continue;
      }

      const two = source.slice(i, i + 2);
      if (["==", "!=", "<=", ">=", "//", "**", "+=", "-=", "*=", "/="].includes(two)) {
        result += '<span class="tok-op">' + escapeHtml(two) + "</span>";
        i += 2;
        continue;
      }

      if ("+-*/%<>=!".includes(ch)) {
        result += '<span class="tok-op">' + escapeHtml(ch) + "</span>";
        i += 1;
        continue;
      }

      result += escapeHtml(ch);
      i += 1;
    }

    return result;
  }

  /* ------------------------------------------------------------------ */
  /* Console                                                            */
  /* ------------------------------------------------------------------ */

  function clearConsole() {
    els.consoleBody.innerHTML = "";
  }

  function addConsole(text, type, line) {
    const row = document.createElement("div");
    row.className = "console-line" + (type ? " is-" + type : "");
    if (line) {
      const ref = document.createElement("span");
      ref.className = "line-ref";
      ref.textContent = "L" + line;
      row.appendChild(ref);
    }
    const copy = document.createElement("span");
    copy.textContent = text;
    row.appendChild(copy);
    els.consoleBody.appendChild(row);
    while (els.consoleBody.children.length > 90) {
      els.consoleBody.removeChild(els.consoleBody.firstElementChild);
    }
    els.consoleBody.scrollTop = els.consoleBody.scrollHeight;
  }

  /* ------------------------------------------------------------------ */
  /* Progress, missions, modals                                         */
  /* ------------------------------------------------------------------ */

  function updateProgress() {
    const count = state.completed.size;
    const percent = Math.round((count / LEVELS.length) * 100);
    els.progressText.textContent = count + " / " + LEVELS.length;
    els.progressBar.style.width = percent + "%";
    els.progressBar.parentElement.setAttribute("aria-valuenow", String(percent));
  }

  function updateMissionsModal() {
    const groups = [];
    const byChapter = new Map();
    LEVELS.forEach((level, index) => {
      if (!byChapter.has(level.chapter)) {
        const group = {
          chapter: level.chapter,
          number: level.chapterNumber,
          items: []
        };
        byChapter.set(level.chapter, group);
        groups.push(group);
      }
      byChapter.get(level.chapter).items.push({ level, index });
    });

    let html = "";
    groups.forEach((group) => {
      html += '<div class="mission-chapter">';
      html += '<div class="chapter-heading">' + escapeHtml(group.chapter) + "</div>";
      group.items.forEach(({ level, index }) => {
        const complete = state.completed.has(level.id);
        const current = index === state.levelIndex;
        html += '<button class="mission-entry' +
          (complete ? " is-complete" : "") +
          (current ? " is-current" : "") +
          '" type="button" data-mission="' + index + '"' +
          (current ? ' aria-current="true"' : "") + ">";
        html += '<span class="mission-number">' + (complete ? icon("check") : String(level.number).padStart(2, "0")) + "</span>";
        html += '<span class="mission-entry-copy"><span class="mission-entry-title">' +
          escapeHtml(level.title) + "<small>" + escapeHtml(level.concept) + "</small></span>" +
          '<span class="mission-entry-sub">' + escapeHtml(level.field) + " · " +
          level.size.w + " × " + level.size.h + " blocks</span></span>";
        html += '<span class="mission-entry-status">' + (current ? "Current" : complete ? "Solved" : "Open") + "</span>";
        html += "</button>";
      });
      html += "</div>";
    });

    els.missionsList.innerHTML = html;
    $$("[data-mission]", els.missionsList).forEach((button) => {
      button.addEventListener("click", () => {
        closeModal("missionsModal");
        renderLevel(Number(button.dataset.mission), { focusEditor: true });
      });
    });
    els.missionsProgress.textContent = state.completed.size + " of " + LEVELS.length + " lessons complete";
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    if (state.activeModal && state.activeModal !== id) closeModal(state.activeModal, true);
    state.lastFocused = document.activeElement;
    state.activeModal = id;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    const close = $(".modal-close", modal);
    if (close) window.setTimeout(() => close.focus(), 80);
  }

  function closeModal(id, keepFocus) {
    const modalId = id || state.activeModal;
    if (!modalId) return;
    const modal = document.getElementById(modalId);
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (state.activeModal === modalId) {
      state.activeModal = null;
      document.body.style.overflow = "";
    }
    if (!keepFocus && state.lastFocused && typeof state.lastFocused.focus === "function") {
      const target = state.lastFocused;
      window.setTimeout(() => target.focus(), 20);
    }
  }

  function resetProgress() {
    const ok = window.confirm("Reset all lesson progress? Completed lessons will be cleared, but your saved code will stay.");
    if (!ok) return;
    state.completed.clear();
    persist();
    closeModal("missionsModal");
    renderLevel(0, { focusEditor: true });
    updateProgress();
    updateMissionsModal();
    showToast("Progress reset. A fresh walk to school.");
  }

  function applySpeed(value, save) {
    state.speed = value;
    els.speedButtons.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.speed) === value);
    });
    if (save) persist();
  }

  function showToast(text) {
    clearTimeout(state.toastTimer);
    els.toast.textContent = text;
    els.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      els.toast.hidden = true;
    }, 2200);
  }

  /* ------------------------------------------------------------------ */
  /* Success celebration                                                */
  /* ------------------------------------------------------------------ */

  function showSuccess(result, level) {
    const isLast = state.levelIndex === LEVELS.length - 1;
    const allDone = state.completed.size === LEVELS.length;
    const titleOptions = [
      "Right on time.",
      "First bell made.",
      "A+ navigation.",
      "You made it!"
    ];
    const title = isLast && allDone
      ? "The whole school run, solved."
      : titleOptions[Math.floor(Math.random() * titleOptions.length)];

    els.successEyebrow.textContent = isLast ? "School run complete" : "Lesson " +
      String(level.number).padStart(2, "0") + " cleared";
    els.successTitle.textContent = title;
    els.successText.textContent = "You walked " + result.moves +
      (result.moves === 1 ? " block" : " blocks") +
      " and reached school on time. Your code did the navigating.";
    els.successBlocks.textContent = String(result.moves);
    els.successActions.textContent = String(result.actions);
    els.successConcept.textContent = level.concept;
    els.successNextBtn.innerHTML = isLast
      ? "See all lessons " + icon("arrow")
      : "Next lesson " + icon("arrow");
    els.successFootnote.textContent = isLast && allDone
      ? "Every lesson complete · replay any route from the menu"
      : "Progress saved · lesson " + String(level.number).padStart(2, "0") + " of " + LEVELS.length;
    buildConfetti();
    openModal("successModal");
  }

  function buildConfetti() {
    els.confetti.innerHTML = "";
    const colors = ["#d8674e", "#f3c64e", "#8fc8cf", "#79a86d", "#f0a6a0", "#294d58"];
    for (let i = 0; i < 42; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = Math.round(Math.random() * 100) + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty("--drift", Math.round((Math.random() - 0.5) * 130) + "px");
      piece.style.setProperty("--spin", Math.round(240 + Math.random() * 620) + "deg");
      piece.style.setProperty("--duration", (1.9 + Math.random() * 1.9).toFixed(2) + "s");
      piece.style.setProperty("--delay", (Math.random() * 0.7).toFixed(2) + "s");
      piece.style.width = (5 + Math.round(Math.random() * 5)) + "px";
      piece.style.height = (7 + Math.round(Math.random() * 7)) + "px";
      els.confetti.appendChild(piece);
    }
    window.setTimeout(() => {
      if (els.successModal.hidden) els.confetti.innerHTML = "";
    }, 4300);
  }
})();

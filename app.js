    // What needs no page (the link codec, the speed and depth scales, the
    // GIF frame math, the color conversions) is in core.js, loaded just
    // before this file. depthIndex, encodeCompact and decodeCompact are
    // wrapped below rather than taken here, since each needs a reading off
    // the page; see them by name.
    const {
      clamp, speedMs, speedStep, formatSpeed, depthValue, formatDepth,
      CYCLE_FRAME_MS, PREVIEW_FRAMES_PER_CYCLE, PREVIEW_MIN_FRAME_MS, beatFrames, frameDelay, framePhase,
      hslToRgb, rgbToHex, hslToHex, hueDistance, hexToHsl, formatColorValue, SHAPE_MASK_DIRECTIONS,
    } = FlieldCore;

    // Inline replacements for the icons that used to come from the
    // Phosphor webfont (224KB for the ~19 glyphs this app actually uses).
    // These are Phosphor's own "bold" weight source paths, MIT-licensed,
    // reading better than "regular" at the 14-18px these render at; the
    // field lock's "locked" state uses "fill" instead, so a solid glyph
    // reinforces the locked state over the open outline of "lock-open".
    const ICONS = {
      "list": "M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128ZM40,76H216a12,12,0,0,0,0-24H40a12,12,0,0,0,0,24ZM216,180H40a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24Z",
      "x": "M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z",
      "sun": "M116,36V20a12,12,0,0,1,24,0V36a12,12,0,0,1-24,0Zm80,92a68,68,0,1,1-68-68A68.07,68.07,0,0,1,196,128Zm-24,0a44,44,0,1,0-44,44A44.05,44.05,0,0,0,172,128ZM51.51,68.49a12,12,0,1,0,17-17l-12-12a12,12,0,0,0-17,17Zm0,119-12,12a12,12,0,0,0,17,17l12-12a12,12,0,1,0-17-17ZM196,72a12,12,0,0,0,8.49-3.51l12-12a12,12,0,0,0-17-17l-12,12A12,12,0,0,0,196,72Zm8.49,115.51a12,12,0,0,0-17,17l12,12a12,12,0,0,0,17-17ZM48,128a12,12,0,0,0-12-12H20a12,12,0,0,0,0,24H36A12,12,0,0,0,48,128Zm80,80a12,12,0,0,0-12,12v16a12,12,0,0,0,24,0V220A12,12,0,0,0,128,208Zm108-92H220a12,12,0,0,0,0,24h16a12,12,0,0,0,0-24Z",
      "moon": "M236.37,139.4a12,12,0,0,0-12-3A84.07,84.07,0,0,1,119.6,31.59a12,12,0,0,0-15-15A108.86,108.86,0,0,0,49.69,55.07,108,108,0,0,0,136,228a107.09,107.09,0,0,0,64.93-21.69,108.86,108.86,0,0,0,38.44-54.94A12,12,0,0,0,236.37,139.4Zm-49.88,47.74A84,84,0,0,1,68.86,69.51,84.93,84.93,0,0,1,92.27,48.29Q92,52.13,92,56A108.12,108.12,0,0,0,200,164q3.87,0,7.71-.27A84.79,84.79,0,0,1,186.49,187.14Z",
      "arrow-counter-clockwise": "M228,128a100,100,0,0,1-98.66,100H128a99.39,99.39,0,0,1-68.62-27.29,12,12,0,0,1,16.48-17.45,76,76,0,1,0-1.57-109c-.13.13-.25.25-.39.37L54.89,92H72a12,12,0,0,1,0,24H24a12,12,0,0,1-12-12V56a12,12,0,0,1,24,0V76.72L57.48,57.06A100,100,0,0,1,228,128Z",
      "shuffle": "M240.49,175.51a12,12,0,0,1,0,17l-24,24a12,12,0,0,1-17-17L203,196h-2.09a76.17,76.17,0,0,1-61.85-31.83L97.38,105.78A52.1,52.1,0,0,0,55.06,84H32a12,12,0,0,1,0-24H55.06a76.17,76.17,0,0,1,61.85,31.83l41.71,58.39A52.1,52.1,0,0,0,200.94,172H203l-3.52-3.51a12,12,0,0,1,17-17Zm-95.62-72.62a12,12,0,0,0,16.93-1.13A52,52,0,0,1,200.94,84H203l-3.52,3.51a12,12,0,0,0,17,17l24-24a12,12,0,0,0,0-17l-24-24a12,12,0,0,0-17,17L203,60h-2.09a76,76,0,0,0-57.2,26A12,12,0,0,0,144.87,102.89Zm-33.74,50.22a12,12,0,0,0-16.93,1.13A52,52,0,0,1,55.06,172H32a12,12,0,0,0,0,24H55.06a76,76,0,0,0,57.2-26A12,12,0,0,0,111.13,153.11Z",
      "lock-simple": "M208,76H180V56A52,52,0,0,0,76,56V76H48A20,20,0,0,0,28,96V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V96A20,20,0,0,0,208,76ZM100,56a28,28,0,0,1,56,0V76H100ZM204,204H52V100H204Z",
      "lock-simple-open": "M208,76H100V56a28,28,0,0,1,28-28c13.51,0,25.65,9.62,28.24,22.39a12,12,0,1,0,23.52-4.78C174.87,21.5,153.1,4,128,4A52.06,52.06,0,0,0,76,56V76H48A20,20,0,0,0,28,96V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V96A20,20,0,0,0,208,76Zm-4,128H52V100H204Z",
      "play": "M234.49,111.07,90.41,22.94A20,20,0,0,0,60,39.87V216.13a20,20,0,0,0,30.41,16.93l144.08-88.13a19.82,19.82,0,0,0,0-33.86ZM84,208.85V47.15L216.16,128Z",
      "pause": "M200,28H160a20,20,0,0,0-20,20V208a20,20,0,0,0,20,20h40a20,20,0,0,0,20-20V48A20,20,0,0,0,200,28Zm-4,176H164V52h32ZM96,28H56A20,20,0,0,0,36,48V208a20,20,0,0,0,20,20H96a20,20,0,0,0,20-20V48A20,20,0,0,0,96,28ZM92,204H60V52H92Z",
      "lock-open": "M208,76H100V56a28,28,0,0,1,28-28c13.51,0,25.65,9.62,28.24,22.39a12,12,0,1,0,23.52-4.78C174.87,21.5,153.1,4,128,4A52.06,52.06,0,0,0,76,56V76H48A20,20,0,0,0,28,96V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V96A20,20,0,0,0,208,76Zm-4,128H52V100H204Zm-92-52a16,16,0,1,1,16,16A16,16,0,0,1,112,152Z",
      "lock": "M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-80,84a12,12,0,1,1,12-12A12,12,0,0,1,128,164Zm32-84H96V56a32,32,0,0,1,64,0Z",
      "floppy-disk": "M222.14,69.17,186.83,33.86A19.86,19.86,0,0,0,172.69,28H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V83.31A19.86,19.86,0,0,0,222.14,69.17ZM164,204H92V160h72Zm40,0H188V156a20,20,0,0,0-20-20H88a20,20,0,0,0-20,20v48H52V52H171l33,33ZM164,84a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h56A12,12,0,0,1,164,84Z",
      "folder-open": "M248.23,112.31A20,20,0,0,0,232,104H220V88a20,20,0,0,0-20-20H132L105.34,48a20.12,20.12,0,0,0-12-4H40A20,20,0,0,0,20,64V208a12,12,0,0,0,12,12H211.1a12,12,0,0,0,11.33-8l28.49-81.47.06-.17A20,20,0,0,0,248.23,112.31ZM92,68l28.8,21.6A12,12,0,0,0,128,92h68v12H69.77a20,20,0,0,0-18.94,13.58L44,137.15V68ZM202.59,196H48.89l23.72-68H226.37Z",
      "download-simple": "M228,144v64a12,12,0,0,1-12,12H40a12,12,0,0,1-12-12V144a12,12,0,0,1,24,0v52H204V144a12,12,0,0,1,24,0Zm-108.49,8.49a12,12,0,0,0,17,0l40-40a12,12,0,0,0-17-17L140,115V32a12,12,0,0,0-24,0v83L96.49,95.51a12,12,0,0,0-17,17Z",
      "caret-down": "M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z",
      "spinner-gap": "M140,32V64a12,12,0,0,1-24,0V32a12,12,0,0,1,24,0Zm84,84H192a12,12,0,0,0,0,24h32a12,12,0,0,0,0-24Zm-42.26,48.77a12,12,0,1,0-17,17l22.63,22.63a12,12,0,0,0,17-17ZM128,180a12,12,0,0,0-12,12v32a12,12,0,0,0,24,0V192A12,12,0,0,0,128,180ZM74.26,164.77,51.63,187.4a12,12,0,0,0,17,17l22.63-22.63a12,12,0,1,0-17-17ZM76,128a12,12,0,0,0-12-12H32a12,12,0,0,0,0,24H64A12,12,0,0,0,76,128ZM68.6,51.63a12,12,0,1,0-17,17L74.26,91.23a12,12,0,0,0,17-17Z",
      "link": "M117.18,188.74a12,12,0,0,1,0,17l-5.12,5.12A58.26,58.26,0,0,1,70.6,228h0A58.62,58.62,0,0,1,29.14,127.92L63.89,93.17a58.64,58.64,0,0,1,98.56,28.11,12,12,0,1,1-23.37,5.44,34.65,34.65,0,0,0-58.22-16.58L46.11,144.89A34.62,34.62,0,0,0,70.57,204h0a34.41,34.41,0,0,0,24.49-10.14l5.11-5.12A12,12,0,0,1,117.18,188.74ZM226.83,45.17a58.65,58.65,0,0,0-82.93,0l-5.11,5.11a12,12,0,0,0,17,17l5.12-5.12a34.63,34.63,0,1,1,49,49L175.1,145.86A34.39,34.39,0,0,1,150.61,156h0a34.63,34.63,0,0,1-33.69-26.72,12,12,0,0,0-23.38,5.44A58.64,58.64,0,0,0,150.56,180h.05a58.28,58.28,0,0,0,41.47-17.17l34.75-34.75a58.62,58.62,0,0,0,0-82.91Z",
      "check": "M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z",
      "question-mark": "M196,96c0,29.47-24.21,54.05-56,59.06V156a12,12,0,0,1-24,0V144a12,12,0,0,1,12-12c24.26,0,44-16.15,44-36s-19.74-36-44-36S84,76.15,84,96a12,12,0,0,1-24,0c0-33.08,30.5-60,68-60S196,62.92,196,96Zm-68,92a20,20,0,1,0,20,20A20,20,0,0,0,128,188Z",
      "share-network": "M176,156a43.78,43.78,0,0,0-29.09,11L106.1,140.8a44.07,44.07,0,0,0,0-25.6L146.91,89a43.83,43.83,0,1,0-13-20.17L93.09,95a44,44,0,1,0,0,65.94L133.9,187.2A44,44,0,1,0,176,156Zm0-120a20,20,0,1,1-20,20A20,20,0,0,1,176,36ZM64,148a20,20,0,1,1,20-20A20,20,0,0,1,64,148Zm112,72a20,20,0,1,1,20-20A20,20,0,0,1,176,220Z",
    };

    function iconSvg(name) {
      // Hidden from assistive tech: every icon sits on a control that is
      // named by its title or label, and an SVG left exposed reads as an
      // unnamed image beside it.
      return `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false"><path d="${ICONS[name]}"/></svg>`;
    }

    function setIcon(el, name) {
      el.className = "ph ph-" + name;
      el.innerHTML = iconSvg(name);
    }

    function iconTag(name) {
      return `<i class="ph ph-${name}">${iconSvg(name)}</i>`;
    }

    // Every icon in the static markup below is stamped with its name via
    // the same "ph-<name>" class this used with the old Phosphor webfont;
    // this just fills each one in with its SVG instead of a font glyph.
    // Exposed as a function (not a one-off pass) since buildLayerControls
    // below clones fresh icon markup from <template> after this first
    // pass has already run, and needs to hydrate that copy too.
    function hydrateIcons(root) {
      root.querySelectorAll(".ph").forEach((el) => {
        const cls = [...el.classList].find((c) => c !== "ph" && c.startsWith("ph-"));
        if (cls) el.innerHTML = iconSvg(cls.slice(3));
      });
    }
    hydrateIcons(document);

    // Dark is the default (set by the blocking script in <head>, which
    // reads this same key); this button is the only way to reach light.
    const THEME_KEY = "flield-theme";
    const themeToggleBtn = document.getElementById("themeToggleBtn");

    function applyTheme(isLight) {
      if (isLight) {
        document.documentElement.setAttribute("data-theme", "light");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      // The browser chrome follows the page ground: --bg in each theme.
      document.querySelector('meta[name="theme-color"]').setAttribute("content", isLight ? "#f4f4f5" : "#09090b");
      themeToggleBtn.innerHTML = iconTag(isLight ? "moon" : "sun");
      themeToggleBtn.title = isLight ? "Switch to dark theme" : "Switch to light theme";
    }
    applyTheme(document.documentElement.getAttribute("data-theme") === "light");

    themeToggleBtn.addEventListener("click", () => {
      const isLight = document.documentElement.getAttribute("data-theme") !== "light";
      applyTheme(isLight);
      try {
        localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
      } catch (err) {
        // localStorage can be unavailable (private browsing, blocked); the
        // toggle still works for this page load, just won't persist.
      }
    });

    // Fades in at whichever edge (or both) still has hidden content, so a
    // tab that overflows shows its bottom fade immediately on switching to
    // it, before any scrolling; each then clears once scrolled to that end.
    const controlsBody = document.querySelector(".controls-body");
    const scrollFadeTop = controlsBody.querySelector(".scroll-fade-top");
    const scrollFadeBottom = controlsBody.querySelector(".scroll-fade-bottom");

    function updateScrollFade() {
      const { scrollTop, scrollHeight, clientHeight } = controlsBody;
      scrollFadeTop.classList.toggle("visible", scrollTop > 1);
      scrollFadeBottom.classList.toggle("visible", scrollTop + clientHeight < scrollHeight - 1);
    }
    controlsBody.addEventListener("scroll", updateScrollFade);
    window.addEventListener("resize", updateScrollFade);

    // Both tab sets, the panel's three and the picker's three formats,
    // behave as ARIA tabs: the selected one is the set's only Tab stop
    // and says so, and the arrows (and Home and End) move between them,
    // selecting as they go, so Tab from a tab goes into what it shows.
    function markTabs(buttons, active) {
      buttons.forEach((b) => {
        b.setAttribute("aria-selected", String(b === active));
        b.tabIndex = b === active ? 0 : -1;
      });
    }

    function arrowTabs(buttons) {
      buttons.forEach((btn, i) => {
        btn.addEventListener("keydown", (e) => {
          const last = buttons.length - 1;
          const to = { ArrowLeft: i === 0 ? last : i - 1, ArrowRight: i === last ? 0 : i + 1, Home: 0, End: last }[e.key];
          if (to === undefined) return;
          e.preventDefault();
          buttons[to].focus();
          buttons[to].click();
        });
      });
    }

    // Wire up tab switching.
    const tabButtons = [...document.querySelectorAll(".tab-btn")];
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = true));
        btn.classList.add("active");
        markTabs(tabButtons, btn);
        document.getElementById("tab-" + btn.dataset.tab).hidden = false;
        updateScrollFade();
      });
    });
    markTabs(tabButtons, tabButtons.find((b) => b.classList.contains("active")));
    arrowTabs(tabButtons);

    // Fields a lock button can be attached to; randomize() skips any of
    // these whose lock is engaged.
    const RANDOMIZABLE_FIELDS = [
      "seed", "color", "density", "fieldStrength", "fieldScale",
      "flowAngle", "flowStretch", "fieldOctaves", "texture", "symmetry", "smoothPasses",
    ];
    const lockedFields = new Set();

    // Sets one lock button's visual/logical state. `btn.dataset.targetId`
    // is assigned once when the button is stamped into its panel (see
    // buildLayerControls below), so this is reusable for both a single
    // click and the Lock All / Unlock All bulk actions.
    function setLock(btn, locked) {
      const targetId = btn.dataset.targetId;
      btn.setAttribute("aria-pressed", String(locked));
      if (locked) {
        lockedFields.add(targetId);
        btn.classList.add("locked");
        setIcon(btn.querySelector("i"), "lock");
        btn.title = "Locked: kept through randomize. Click to unlock";
      } else {
        lockedFields.delete(targetId);
        btn.classList.remove("locked");
        setIcon(btn.querySelector("i"), "lock-open");
        btn.title = "Lock from randomization";
      }
      updateLockCounts();
    }

    // Each lock is named for its field ("Lock Seed") and carries its state
    // in aria-pressed, where all 25 used to read "Lock from randomization"
    // and none said whether it was on. The name is the field's own label
    // less its readout, so a label a texture renames (see
    // updateLayerLabels) renames its lock with it.
    function nameLock(btn) {
      const label = btn.closest(".field").querySelector("label");
      const name = [...label.childNodes]
        .filter((n) => !(n.nodeType === Node.ELEMENT_NODE && n.classList.contains("field-value")))
        .map((n) => n.textContent)
        .join("")
        .trim();
      btn.setAttribute("aria-label", "Lock " + name);
    }

    // Each tab shows how many of its own fields are locked, so the state
    // of a tab that isn't open is still readable at a glance (before
    // this, Lock All on the General tab left no visible trace that
    // Layer A and B had changed too). General's lock ids are bare
    // ("bgColor"); a layer's are prefixed ("layerA-seed").
    //
    // A tab's total is counted the same way as its locked fields, from
    // the ids, not from what its panel holds at the moment. On a phone a
    // field pinned to the strip above the bar has left its panel, and a
    // total counted there came up one short: "11 of 10 fields locked",
    // and a padlock that never filled in.
    function updateLockCounts() {
      const tabOf = (id) => (id.startsWith("layerA-") ? "layerA" : id.startsWith("layerB-") ? "layerB" : "general");
      const counts = { general: 0, layerA: 0, layerB: 0 };
      const totals = { general: 0, layerA: 0, layerB: 0 };
      lockedFields.forEach((id) => { counts[tabOf(id)] += 1; });
      document.querySelectorAll(".lock-btn").forEach((btn) => { totals[tabOf(btn.dataset.targetId || "")] += 1; });
      document.querySelectorAll(".tab-btn").forEach((btn) => {
        const tab = btn.dataset.tab;
        const n = counts[tab] || 0;
        const total = totals[tab] || 0;
        // A single glyph rather than a number, which didn't fit beside
        // "Layer A" in an 80px segment: outline padlock when some of
        // the tab's fields are locked, solid when all of them are. The
        // exact count lives in the tooltip and the accessible name.
        const indicator = btn.querySelector(".tab-count");
        indicator.innerHTML = n ? iconSvg(n === total ? "lock" : "lock-simple") : "";
        indicator.classList.toggle("all", n > 0 && n === total);
        const label = tab === "general" ? "General" : "Layer " + tab.slice(-1);
        const detail = n ? `${n} of ${total} fields locked` : "";
        btn.title = detail;
        btn.setAttribute("aria-label", detail ? `${label}, ${detail}` : label);
      });
      // Lock All mirrors the tabs: its padlock fills in once every field
      // is locked, and drops back to the outline the moment any one of
      // them is unlocked again.
      const allLocked = lockedFields.size > 0 && lockedFields.size === document.querySelectorAll(".lock-btn").length;
      setIcon(document.querySelector("#lockAllBtn i"), allLocked ? "lock" : "lock-simple");
    }

    // Stamp the shared layer-control template into each layer's tab panel,
    // then wire each field's lock button (data-for="<field>") to toggle
    // that field's id in `lockedFields`.
    function buildLayerControls(panel, prefix) {
      const tpl = document.getElementById("layer-template");
      const frag = tpl.content.cloneNode(true);
      hydrateIcons(frag);
      frag.querySelectorAll("[class*='l-']").forEach((el) => {
        el.classList.forEach((cls) => {
          if (cls.startsWith("l-")) el.id = prefix + "-" + cls.slice(2);
        });
      });
      // Each .field wraps exactly one label and one labelable control;
      // pair them now that the control has its final id, so the label
      // text is announced to screen readers and clicking it focuses
      // the control (neither worked with a bare, unassociated <label>).
      frag.querySelectorAll(".field").forEach((field) => {
        const label = field.querySelector("label");
        const control = field.querySelector(".color-swatch") || field.querySelector("input, select");
        if (label && control && control.id) label.setAttribute("for", control.id);
      });
      frag.querySelectorAll(".lock-btn").forEach((btn) => {
        btn.dataset.targetId = prefix + "-" + btn.dataset.for;
        btn.setAttribute("aria-pressed", "false");
        nameLock(btn);
        btn.addEventListener("click", () => setLock(btn, !lockedFields.has(btn.dataset.targetId)));
      });
      frag.querySelectorAll(".palette-preset-btn").forEach((btn) => {
        btn.addEventListener("click", () => applyPalettePreset(prefix, btn.dataset.preset));
      });
      frag.querySelectorAll(".palette-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
          const content = btn.nextElementSibling;
          const isOpen = btn.getAttribute("aria-expanded") === "true";
          btn.setAttribute("aria-expanded", String(!isOpen));
          content.hidden = isOpen;
          updateScrollFade();
        });
      });
      panel.prepend(frag);
    }
    buildLayerControls(document.getElementById("tab-layerA"), "layerA");
    buildLayerControls(document.getElementById("tab-layerB"), "layerB");

    // A last line carrying one word reads as a mistake in a column this
    // narrow, and the CSS for it does not work here: with
    // `text-wrap: pretty` on and off, the same lines widow at every
    // width the sidebar and the phone sheet take. So the last two words
    // are tied with a non-breaking space, which the line breaker cannot
    // decline. Text only, and re-run for the hints the script rewrites.
    const NBSP = "\u00a0";
    function tieLastWords(el) {
      if (!el || el.children.length) return;
      const text = el.textContent.replace(/\u00a0/g, " ").trim();
      el.textContent = text.replace(/\s+(\S+)$/, NBSP + "$1");
    }
    document.querySelectorAll(".controls .hint").forEach(tieLastWords);

    // Custom color picker: a 2D saturation/lightness square plus a hue
    // strip, in a Floating UI-positioned popover shared by every swatch.
    // The value below the square can be read or typed as hex, RGB, or
    // HSL; all three stay in sync with the same underlying color. Each
    // swatch's hidden .color-input-native stays the real value store
    // (readOptions, randomize, saved states and shared links all
    // read/write it directly, same as before this UI existed); the
    // picker only ever sets its .value and dispatches "input" so the
    // existing delegated listener on .controls picks it up.
    const colorPopover = document.getElementById("colorPopover");
    const colorSLCanvas = document.getElementById("colorSLCanvas");
    const colorSLCtx = colorSLCanvas.getContext("2d");
    const colorSLSquare = colorPopover.querySelector(".color-sl-square");
    const colorSLThumb = colorPopover.querySelector(".color-sl-thumb");
    const colorHueStrip = document.getElementById("colorHueStrip");
    const colorHueThumb = colorPopover.querySelector(".color-hue-thumb");
    const colorHexInput = document.getElementById("colorHexInput");
    const colorRInput = document.getElementById("colorRInput");
    const colorGInput = document.getElementById("colorGInput");
    const colorBInput = document.getElementById("colorBInput");
    const colorHInput = document.getElementById("colorHInput");
    const colorSInput = document.getElementById("colorSInput");
    const colorLInput = document.getElementById("colorLInput");

    let colorActiveInput = null;
    let colorActiveSwatch = null;
    let colorAutoUpdateCleanup = null;
    let colorCurrent = { h: 0, s: 0, l: 0 };
    let colorFormat = "hex";

    const colorFormatButtons = [...document.querySelectorAll(".color-format-btn")];
    colorFormatButtons.forEach((btn) => {
      btn.addEventListener("click", () => setColorFormat(btn.dataset.format));
    });
    markTabs(colorFormatButtons, colorFormatButtons.find((b) => b.classList.contains("active")));
    arrowTabs(colorFormatButtons);

    function setColorFormat(format) {
      colorFormat = format;
      colorFormatButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.format === format);
      });
      markTabs(colorFormatButtons, colorFormatButtons.find((b) => b.dataset.format === format));
      document.querySelectorAll(".color-value-row").forEach((row) => {
        row.hidden = row.dataset.formatPanel !== format;
      });
      updateFormatFields();
      updateColorSwatches();
    }

    // Writes colorCurrent into whichever format's fields are visible.
    // `skip` names the format that just produced this value (the user is
    // actively typing there), so that field isn't overwritten mid-edit.
    function updateFormatFields(skip) {
      if (colorFormat === skip) return;
      if (colorFormat === "hex") {
        colorHexInput.value = hslToHex(colorCurrent.h, colorCurrent.s, colorCurrent.l).slice(1).toUpperCase();
      } else if (colorFormat === "rgb") {
        const [r, g, b] = hslToRgb(colorCurrent.h, colorCurrent.s, colorCurrent.l);
        colorRInput.value = r;
        colorGInput.value = g;
        colorBInput.value = b;
      } else {
        colorHInput.value = Math.round(colorCurrent.h);
        colorSInput.value = Math.round(colorCurrent.s);
        colorLInput.value = Math.round(colorCurrent.l);
      }
    }

    function drawColorSquare() {
      const { width, height } = colorSLCanvas;
      const img = colorSLCtx.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        const l = 100 - (y / (height - 1)) * 100;
        for (let x = 0; x < width; x++) {
          const s = (x / (width - 1)) * 100;
          const [r, g, b] = hslToRgb(colorCurrent.h, s, l);
          const i = (y * width + x) * 4;
          img.data[i] = r;
          img.data[i + 1] = g;
          img.data[i + 2] = b;
          img.data[i + 3] = 255;
        }
      }
      colorSLCtx.putImageData(img, 0, 0);
    }

    function positionColorThumbs() {
      colorSLThumb.style.left = colorCurrent.s + "%";
      colorSLThumb.style.top = 100 - colorCurrent.l + "%";
      colorHueThumb.style.left = (colorCurrent.h / 360) * 100 + "%";
      const s = Math.round(colorCurrent.s);
      const l = Math.round(colorCurrent.l);
      colorSLSquare.setAttribute("aria-valuenow", s);
      colorSLSquare.setAttribute("aria-valuetext", `Saturation ${s}%, lightness ${l}%`);
      colorHueStrip.setAttribute("aria-valuenow", Math.round(colorCurrent.h));
      colorHueStrip.setAttribute("aria-valuetext", `${Math.round(colorCurrent.h)} degrees`);
    }

    function commitColor() {
      if (!colorActiveInput) return;
      const hex = hslToHex(colorCurrent.h, colorCurrent.s, colorCurrent.l);
      colorActiveInput.value = hex;
      colorActiveInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function openColorPicker(swatch) {
      const input = swatch.closest(".color-picker").querySelector(".color-input-native");
      colorActiveInput = input;
      colorActiveSwatch = swatch;
      colorCurrent = hexToHsl(input.value);
      drawColorSquare();
      positionColorThumbs();
      updateFormatFields();
      colorPopover.hidden = false;
      swatch.setAttribute("aria-expanded", "true");
      // The popover sits far from its swatch in the document, so Tab from
      // the swatch would never reach it; focus is taken there instead,
      // and handed back on the way out (see closeColorPicker).
      colorSLSquare.focus({ preventScroll: true });

      // Placement mirrors "bottom-start" with an 8px gap: aligned to the
      // swatch's left edge, below it, flipping above when it wouldn't
      // fit and shifted horizontally to stay clear of the viewport edge.
      function reposition() {
        const gap = 8;
        const padding = 8;
        const swatchRect = swatch.getBoundingClientRect();
        const popoverRect = colorPopover.getBoundingClientRect();

        let top = swatchRect.bottom + gap;
        if (top + popoverRect.height > window.innerHeight - padding) {
          const above = swatchRect.top - gap - popoverRect.height;
          if (above >= padding) top = above;
        }

        let left = swatchRect.left;
        left = Math.min(left, window.innerWidth - popoverRect.width - padding);
        left = Math.max(left, padding);

        colorPopover.style.left = left + window.scrollX + "px";
        colorPopover.style.top = top + window.scrollY + "px";
      }
      reposition();
      const repositionResizeObserver = new ResizeObserver(reposition);
      repositionResizeObserver.observe(colorPopover);
      window.addEventListener("scroll", reposition, { capture: true, passive: true });
      window.addEventListener("resize", reposition);
      colorAutoUpdateCleanup = () => {
        repositionResizeObserver.disconnect();
        window.removeEventListener("scroll", reposition, { capture: true });
        window.removeEventListener("resize", reposition);
      };
    }

    function closeColorPicker() {
      if (colorPopover.hidden) return;
      // Only when focus is inside: a click elsewhere has put it where the
      // visitor wanted, and that stands.
      const hadFocus = colorPopover.contains(document.activeElement);
      colorPopover.hidden = true;
      if (colorActiveSwatch) colorActiveSwatch.setAttribute("aria-expanded", "false");
      if (hadFocus && colorActiveSwatch) colorActiveSwatch.focus();
      if (colorAutoUpdateCleanup) {
        colorAutoUpdateCleanup();
        colorAutoUpdateCleanup = null;
      }
      colorActiveInput = null;
      colorActiveSwatch = null;
    }

    document.querySelectorAll(".color-swatch").forEach((swatch) => {
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        if (colorActiveSwatch === swatch) {
          closeColorPicker();
        } else {
          openColorPicker(swatch);
        }
      });
    });

    function clampedPoint(el, evt) {
      const rect = el.getBoundingClientRect();
      return {
        x: Math.min(Math.max(evt.clientX - rect.left, 0), rect.width),
        y: Math.min(Math.max(evt.clientY - rect.top, 0), rect.height),
        rect,
      };
    }

    let colorDragTarget = null;

    colorSLCanvas.addEventListener("pointerdown", (e) => {
      colorDragTarget = "square";
      colorSLCanvas.setPointerCapture(e.pointerId);
      dragColorSquare(e);
    });
    colorSLCanvas.addEventListener("pointermove", (e) => {
      if (colorDragTarget === "square") dragColorSquare(e);
    });
    colorSLCanvas.addEventListener("pointerup", () => {
      colorDragTarget = null;
    });

    colorHueStrip.addEventListener("pointerdown", (e) => {
      colorDragTarget = "hue";
      colorHueStrip.setPointerCapture(e.pointerId);
      dragColorHue(e);
    });
    colorHueStrip.addEventListener("pointermove", (e) => {
      if (colorDragTarget === "hue") dragColorHue(e);
    });
    colorHueStrip.addEventListener("pointerup", () => {
      colorDragTarget = null;
    });

    // Arrow keys move a slider by one, Shift by ten, as a native range
    // input does. The square reads left and right as saturation, up and
    // down as lightness; the strip reads all four as hue, and Home and
    // End go to either end of it.
    function colorKeySteps(e) {
      const step = e.shiftKey ? 10 : 1;
      return { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowDown: [0, -step], ArrowUp: [0, step] }[e.key];
    }

    colorSLSquare.addEventListener("keydown", (e) => {
      const move = colorKeySteps(e);
      if (!move) return;
      e.preventDefault();
      colorCurrent.s = clamp(colorCurrent.s + move[0], 0, 100);
      colorCurrent.l = clamp(colorCurrent.l + move[1], 0, 100);
      positionColorThumbs();
      updateFormatFields();
      commitColor();
    });

    colorHueStrip.addEventListener("keydown", (e) => {
      const move = colorKeySteps(e);
      let h;
      if (move) h = colorCurrent.h + move[0] + move[1];
      else if (e.key === "Home") h = 0;
      else if (e.key === "End") h = 360;
      else return;
      e.preventDefault();
      colorCurrent.h = clamp(h, 0, 360);
      drawColorSquare();
      positionColorThumbs();
      updateFormatFields();
      commitColor();
    });

    // Tab wraps inside the open picker, so it cannot walk off into the
    // page with the popover still showing. Escape closes it.
    colorPopover.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const stops = [...colorPopover.querySelectorAll("[tabindex='0'], button, input")].filter((el) => el.checkVisibility());
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    function dragColorSquare(e) {
      const { x, y, rect } = clampedPoint(colorSLCanvas, e);
      colorCurrent.s = (x / rect.width) * 100;
      colorCurrent.l = 100 - (y / rect.height) * 100;
      positionColorThumbs();
      updateFormatFields();
      commitColor();
    }

    function dragColorHue(e) {
      const { x, rect } = clampedPoint(colorHueStrip, e);
      colorCurrent.h = (x / rect.width) * 360;
      drawColorSquare();
      positionColorThumbs();
      updateFormatFields();
      commitColor();
    }

    colorHexInput.addEventListener("input", () => {
      const v = colorHexInput.value.trim();
      if (/^[0-9a-fA-F]{6}$/.test(v)) {
        colorCurrent = hexToHsl("#" + v);
        drawColorSquare();
        positionColorThumbs();
        updateFormatFields("hex");
        commitColor();
      }
    });
    colorHexInput.addEventListener("blur", () => {
      if (colorActiveInput) colorHexInput.value = colorActiveInput.value.slice(1).toUpperCase();
    });

    function readChannelInput(el, max) {
      const n = parseInt(el.value, 10);
      return Number.isNaN(n) ? 0 : clamp(n, 0, max);
    }

    function onRgbInput() {
      const r = readChannelInput(colorRInput, 255);
      const g = readChannelInput(colorGInput, 255);
      const b = readChannelInput(colorBInput, 255);
      colorCurrent = hexToHsl(rgbToHex(r, g, b));
      drawColorSquare();
      positionColorThumbs();
      updateFormatFields("rgb");
      commitColor();
    }
    [colorRInput, colorGInput, colorBInput].forEach((el) => el.addEventListener("input", onRgbInput));

    function onHslInput() {
      colorCurrent = {
        h: clamp(parseInt(colorHInput.value, 10) || 0, 0, 360),
        s: clamp(parseInt(colorSInput.value, 10) || 0, 0, 100),
        l: clamp(parseInt(colorLInput.value, 10) || 0, 0, 100),
      };
      drawColorSquare();
      positionColorThumbs();
      updateFormatFields("hsl");
      commitColor();
    }
    [colorHInput, colorSInput, colorLInput].forEach((el) => el.addEventListener("input", onHslInput));

    document.addEventListener("click", (e) => {
      if (!colorPopover.hidden && !colorPopover.contains(e.target) && !e.target.closest(".color-swatch")) {
        closeColorPicker();
      }
    });
    // Escape is handled once, for every layer (see the end of the tour
    // section below), so it closes only the one on top.

    // Background color, block size, and shape mask aren't per-layer fields,
    // so their lock buttons (in the General tab's own markup, not the layer
    // template) target their own id directly instead of a "<prefix>-<field>"
    // one. All three start locked, so the initial composition keeps its
    // intended starting values instead of an immediate randomize pass
    // overwriting them; unlock any of them to fold it into future randomize
    // passes.
    document.querySelectorAll("#tab-general .lock-btn").forEach((btn) => {
      btn.dataset.targetId = btn.dataset.for;
      nameLock(btn);
      btn.addEventListener("click", () => setLock(btn, !lockedFields.has(btn.dataset.targetId)));
      setLock(btn, true);
    });

    // Base density stays unlocked like every other randomizable layer
    // field; keeping the first randomize pass off a near-solid fill is
    // Density Range's job (its default max is well under 1.0, see
    // densityMax below), not a lock on density itself.
    const defaults = {
      layerA: {
        seed: "hello-world",
        color: "#38bdf8",
        hueMin: 0,
        hueMax: 360,
        satMin: 55,
        satMax: 85,
        lightMin: 45,
        lightMax: 65,
        density: 0.5,
        densityMin: 0,
        densityMax: 0.5,
        fieldStrength: 0.3,
        fieldScale: 80,
        flowAngle: 45,
        flowStretch: 3,
        fieldOctaves: 2,
        texture: "streaks",
        symmetry: "quad",
        smoothPasses: 1,
      },
      layerB: {
        seed: "hello-world-accent",
        color: "#f472b6",
        hueMin: 0,
        hueMax: 360,
        satMin: 55,
        satMax: 85,
        lightMin: 45,
        lightMax: 65,
        density: 0.5,
        densityMin: 0,
        densityMax: 0.5,
        fieldStrength: 0.3,
        fieldScale: 50,
        flowAngle: 200,
        flowStretch: 3,
        fieldOctaves: 2,
        texture: "streaks",
        symmetry: "none",
        smoothPasses: 1,
      },
    };

    function applyDefaults(prefix, values) {
      document.getElementById(prefix + "-seed").value = values.seed;
      document.getElementById(prefix + "-color").value = values.color;
      document.getElementById(prefix + "-hueMin").value = values.hueMin;
      document.getElementById(prefix + "-hueMax").value = values.hueMax;
      document.getElementById(prefix + "-satMin").value = values.satMin;
      document.getElementById(prefix + "-satMax").value = values.satMax;
      document.getElementById(prefix + "-lightMin").value = values.lightMin;
      document.getElementById(prefix + "-lightMax").value = values.lightMax;
      document.getElementById(prefix + "-density").value = values.density;
      document.getElementById(prefix + "-densityMin").value = values.densityMin;
      document.getElementById(prefix + "-densityMax").value = values.densityMax;
      document.getElementById(prefix + "-fieldStrength").value = values.fieldStrength;
      document.getElementById(prefix + "-fieldScale").value = values.fieldScale;
      document.getElementById(prefix + "-flowAngle").value = values.flowAngle;
      document.getElementById(prefix + "-flowStretch").value = values.flowStretch;
      document.getElementById(prefix + "-fieldOctaves").value = values.fieldOctaves;
      // Absent from every slot and link written before the second
      // texture existed, which is exactly the one they were made with.
      document.getElementById(prefix + "-texture").value = values.texture || "streaks";
      // Absent from every snapshot written before layers had their own
      // motion, and those followed General, which is what "same" is.
      document.getElementById(prefix + "-motion").value = values.motion || "same";
      document.getElementById(prefix + "-symmetry").value = values.symmetry;
      document.getElementById(prefix + "-smoothPasses").value = values.smoothPasses;
    }
    applyDefaults("layerA", defaults.layerA);
    applyDefaults("layerB", defaults.layerB);

    const canvas = document.getElementById("preview");

    // The canvas is anchored at the artboard's top-left corner and
    // centered with a transform (see #preview in style.css) rather than
    // by flex: a transform doesn't move an element's layout position,
    // so the canvas changing size on every Random pass or Auto-randomize
    // tick isn't a layout shift. Re-run whenever the canvas or the area
    // around it changes size. ResizeObserver callbacks run after layout
    // and before paint, so the artwork never lands off-center for a frame.
    const canvasArea = canvas.parentElement;
    function centerCanvas() {
      const x = Math.round((canvasArea.clientWidth - canvas.offsetWidth) / 2 - canvas.offsetLeft);
      const y = Math.round((canvasArea.clientHeight - canvas.offsetHeight) / 2 - canvas.offsetTop);
      canvas.style.transform = `translate(${x}px, ${y}px)`;
    }
    const canvasSizeObserver = new ResizeObserver(centerCanvas);
    canvasSizeObserver.observe(canvas);
    canvasSizeObserver.observe(canvasArea);

    function readLayer(prefix) {
      return {
        seed: document.getElementById(prefix + "-seed").value || prefix,
        color: document.getElementById(prefix + "-color").value,
        hueMin: parseFloat(document.getElementById(prefix + "-hueMin").value),
        hueMax: parseFloat(document.getElementById(prefix + "-hueMax").value),
        satMin: parseFloat(document.getElementById(prefix + "-satMin").value),
        satMax: parseFloat(document.getElementById(prefix + "-satMax").value),
        lightMin: parseFloat(document.getElementById(prefix + "-lightMin").value),
        lightMax: parseFloat(document.getElementById(prefix + "-lightMax").value),
        density: parseFloat(document.getElementById(prefix + "-density").value),
        densityMin: parseFloat(document.getElementById(prefix + "-densityMin").value),
        densityMax: parseFloat(document.getElementById(prefix + "-densityMax").value),
        fieldStrength: parseFloat(document.getElementById(prefix + "-fieldStrength").value),
        fieldScale: parseInt(document.getElementById(prefix + "-fieldScale").value, 10),
        flowAngle: parseInt(document.getElementById(prefix + "-flowAngle").value, 10),
        flowStretch: parseFloat(document.getElementById(prefix + "-flowStretch").value),
        fieldOctaves: parseInt(document.getElementById(prefix + "-fieldOctaves").value, 10),
        texture: document.getElementById(prefix + "-texture").value,
        motion: document.getElementById(prefix + "-motion").value,
        symmetry: document.getElementById(prefix + "-symmetry").value,
        smoothPasses: parseInt(document.getElementById(prefix + "-smoothPasses").value, 10),
      };
    }

    // Every texture steers by the same five flow controls, but some of
    // them do a visibly different job once the field is a heading
    // rather than a shade, so the labels say which job. Nothing is
    // remapped behind the scenes that isn't renamed here.
    //
    // The hints stay to one clause each. They are read past on the way
    // to a slider, not studied, and on a phone the sidebar is a sheet
    // over the artwork where every line costs a line of the picture.
    // A title attribute would be the obvious place for the rest and is
    // the wrong one: it never appears on a touch device. The guide
    // carries the full explanation instead.
    // Base density is deliberately not in here. Contours reads it as
    // line weight, but the Density Range panel under it, and the min and
    // max inside that, all keep saying density, and renaming one of the
    // four made the cluster disagree with itself.
    const TEXTURE_NAMES = ["fieldStrength", "flowStretch", "smoothPasses"];
    const BIASED = {
      fieldStrength: "Field strength",
      flowStretch: "Flow stretch",
      smoothPasses: "Smoothing passes",
    };
    const TRACED = {
      fieldStrength: "Curl",
      flowStretch: "Trail length",
      smoothPasses: "Strand weight",
    };
    const TEXTURE_LABELS = {
      streaks: Object.assign({
        hint: "Biases each cell's chance of filling. Bands.",
      }, BIASED),
      nebula: Object.assign({
        hint: "Folded at zero into filaments and voids.",
      }, BIASED),
      marble: Object.assign({
        hint: "Streaks folded by a second, coarser field.",
      }, BIASED),
      contours: Object.assign({}, BIASED, {
        hint: "The field's level lines, not its shading.",
        fieldStrength: "Levels",
        // Levels are countable, so the readout counts them rather than
        // showing the strength the slider happens to store. Anything
        // renamed to a unit it doesn't read in needs one of these, or
        // the label says one thing and the number beside it another.
        // Zero is no field at all, plain noise, so it counts zero; above
        // that the generator floors the count at one.
        fieldStrengthValue: (strength) => String(strength > 0 ? Math.max(1, Math.round(CONTOUR_LEVELS * strength)) : 0),
      }),
      streamlines: Object.assign({
        hint: "Particles traced along the field's headings.",
      }, TRACED),
      weave: Object.assign({
        hint: "Streamlines twice, the second set crossing.",
      }, TRACED),
    };

    function updateLayerLabels(prefix, layer) {
      const texture = TEXTURE_LABELS[layer.texture] || TEXTURE_LABELS.streaks;
      const hint = document.getElementById(prefix + "-textureHint");
      hint.textContent = texture.hint;
      tieLastWords(hint);
      TEXTURE_NAMES.forEach((key) => {
        document.getElementById(prefix + "-" + key + "Name").textContent = texture[key];
      });
      // By id rather than by panel: a field out on the phone strip has
      // left its panel and still needs its lock renamed.
      document.querySelectorAll(`.lock-btn[data-target-id^="${prefix}-"]`).forEach(nameLock);
      document.getElementById(prefix + "-hueMinVal").textContent = layer.hueMin + "°";
      document.getElementById(prefix + "-hueMaxVal").textContent = layer.hueMax + "°";
      document.getElementById(prefix + "-satMinVal").textContent = layer.satMin + "%";
      document.getElementById(prefix + "-satMaxVal").textContent = layer.satMax + "%";
      document.getElementById(prefix + "-lightMinVal").textContent = layer.lightMin + "%";
      document.getElementById(prefix + "-lightMaxVal").textContent = layer.lightMax + "%";
      document.getElementById(prefix + "-densityVal").textContent = layer.density.toFixed(2);
      document.getElementById(prefix + "-densityMinVal").textContent = layer.densityMin.toFixed(2);
      document.getElementById(prefix + "-densityMaxVal").textContent = layer.densityMax.toFixed(2);
      // Two decimals, three only when the value sits on a half step (a
      // state from before the field gain, halved on load), unless the
      // texture reads the slider as something with a unit of its own.
      const strength = layer.fieldStrength;
      document.getElementById(prefix + "-fieldStrengthVal").textContent = texture.fieldStrengthValue
        ? texture.fieldStrengthValue(strength)
        : Math.round(strength * 1000) % 10 ? strength.toFixed(3) : strength.toFixed(2);
      document.getElementById(prefix + "-fieldScaleVal").textContent = layer.fieldScale + "px";
      document.getElementById(prefix + "-flowAngleVal").textContent = layer.flowAngle + "°";
      document.getElementById(prefix + "-flowStretchVal").textContent = layer.flowStretch.toFixed(1);
      document.getElementById(prefix + "-fieldOctavesVal").textContent = layer.fieldOctaves;
      document.getElementById(prefix + "-smoothVal").textContent = layer.smoothPasses;
    }

    // Only rebuilds the option list when the shape type actually changed
    // (tracked via the select's own dataset), so calling this on every
    // render() (needed to keep the field's visibility in sync) doesn't
    // stomp a direction the user, or a randomize pass, already picked.
    function updateShapeMaskDirectionUI() {
      const shapeMask = document.getElementById("shapeMask").value;
      const field = document.getElementById("shapeMaskDirectionField");
      const select = document.getElementById("shapeMaskDirection");
      const directions = SHAPE_MASK_DIRECTIONS[shapeMask];
      if (!directions) {
        field.hidden = true;
        return;
      }
      field.hidden = false;
      if (select.dataset.forShape !== shapeMask) {
        select.innerHTML = directions.map((d) => `<option value="${d.value}">${d.label}</option>`).join("");
        select.dataset.forShape = shapeMask;
      }
    }

    // Speed times a cycle, so it appears with one and goes away with it,
    // its description along with it: the hint lives inside the field.
    // If it is the field currently pinned above the bar on a phone (see
    // showLastField), it goes home first: hiding it there would leave an
    // empty strip with a close button and nothing in it.
    function updateMotionUI() {
      const show = !!currentMotion();
      ["speedField", "depthField", "directionField", "collideField"].forEach((id) => {
        const field = document.getElementById(id);
        if (!show && field.closest("#lastControl")) returnLastField();
        field.hidden = !show;
      });
    }

    // Bumped whenever a saved field's meaning changes; upgradeState()
    // below converts older snapshots so they still render the same.
    //   v2: fieldScale is canvas pixels (was grid cells), and
    //       fieldStrength is multiplied by FIELD_GAIN in the generator.
    const STATE_VERSION = 2;
    // The longest side a canvas will be, whatever asks for more: a typed
    // value, a saved slot, or a link. The link's size field is 20 bits
    // wide, so one could ask for a million pixels a side; at 32000 a
    // render took twenty seconds and several gigabytes, and the canvas
    // came out blank because it was past what a browser will draw. The
    // number is generous for a background (twice a 4K hero) and is the
    // inputs' max as well, so the field says what the canvas does.
    const MAX_SIDE_PX = 8192;
    const clampSide = (value) => Math.min(MAX_SIDE_PX, Math.max(16, parseInt(value, 10) || 100));
    // The side cap alone still let a link ask for 8192 by 8192, four
    // times this many pixels, and at block size 2 with a motion that is
    // four to seven seconds a frame, back to back: a frozen tab from a
    // link. So the area is capped too, at a 4096 square's worth. A
    // canvas over it is scaled down with its shape kept, both sides
    // rounded down so the result is under the cap and clamping it again
    // changes nothing. An 8192 by 2048 banner and a 5K background fit.
    const MAX_AREA_PX = 4096 * 4096;
    function clampSize(width, height) {
      let w = clampSide(width);
      let h = clampSide(height);
      if (w * h > MAX_AREA_PX) {
        const scale = Math.sqrt(MAX_AREA_PX / (w * h));
        w = Math.max(16, Math.floor(w * scale));
        h = Math.max(16, Math.floor(h * scale));
      }
      return [w, h];
    }

    const speedInput = document.getElementById("speed");
    const intervalInput = document.getElementById("interval");
    // Depth travels as a multiplier (0.25 to 2) and sits on the slider
    // as quarters, so the default 1x is index 4.
    const depthInput = document.getElementById("depth");
    const directionSelect = document.getElementById("direction");
    const collideInput = document.getElementById("collide");
    const DEPTH_DEFAULT_INDEX = parseInt(depthInput.defaultValue, 10);
    const depthIndex = (value) =>
      FlieldCore.depthIndex(value, parseInt(depthInput.min, 10), parseInt(depthInput.max, 10));

    function readOptions() {
      const [width, height] = clampSize(document.getElementById("width").value, document.getElementById("height").value);
      return {
        v: STATE_VERSION,
        speed: speedMs(parseInt(speedInput.value, 10)),
        interval: speedMs(parseInt(intervalInput.value, 10)),
        depth: depthValue(parseInt(depthInput.value, 10)),
        direction: directionSelect.value,
        collide: parseInt(collideInput.value, 10) / 10,
        bgColor: document.getElementById("bgColor").value,
        width,
        height,
        blockSize: parseInt(document.getElementById("blockSize").value, 10),
        shapeMask: document.getElementById("shapeMask").value,
        shapeMaskDirection: document.getElementById("shapeMaskDirection").value,
        layerA: readLayer("layerA"),
        layerB: readLayer("layerB"),
      };
    }

    let lastResult = null;
    let lastOptions = null;

    // A snapshot for a link or a slot: the composition plus the lock
    // set, so opening it restores how Random and Auto-randomize were
    // set up, not just what was on the canvas. Undo keeps using the
    // bare readOptions() on purpose: reverting locks along with a pass
    // would be surprising.
    function snapshotForSharing() {
      const snapshot = Object.assign(readOptions(), { locks: [...lockedFields] });
      // Motion is part of what the piece is, not a playback preference,
      // so it travels with every link rather than only the ones marked
      // to play. Left off entirely when there is none, so links from
      // still compositions are no longer than they were. The General
      // kind and nothing else: a layer's own kind already travels in
      // its layer. Writing currentMotion() here turned General None with
      // layer A on Drift into General Drift, and layer B, set to follow
      // General, moved on the other end when it had been still.
      const kind = generalMotion();
      if (kind) snapshot.motion = kind;
      return snapshot;
    }

    // What a link or a slot hands over is only as whole as whoever
    // wrote it, and the controls take whatever they are given: a missing
    // layer threw halfway through, after the size and the background
    // had already been applied, and a menu handed a value it does not
    // list was left showing nothing. So the gaps are filled before any
    // control is touched. A missing or malformed layer is the default
    // one, a menu value this build does not have is that menu's
    // default, and a color or a number that is not one is the control's
    // own. Something that is not a composition at all throws, which the
    // caller reports, with the page still as it was.
    function normalizeSnapshot(data) {
      const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
      if (!isObject(data)) throw new Error("not a composition");
      const el = (id) => document.getElementById(id);
      const listed = (id, value, fallback) => ([...el(id).options].some((o) => o.value === value) ? value : fallback);
      const out = Object.assign({}, data);
      if (!/^#[0-9a-f]{6}$/i.test(out.bgColor)) out.bgColor = el("bgColor").defaultValue;
      ["width", "height", "blockSize"].forEach((key) => {
        if (!Number.isFinite(parseFloat(out[key]))) out[key] = el(key).defaultValue;
      });
      out.shapeMask = listed("shapeMask", out.shapeMask, "none");
      ["layerA", "layerB"].forEach((prefix) => {
        const layer = Object.assign({}, defaults[prefix], isObject(data[prefix]) ? data[prefix] : null);
        layer.symmetry = listed(prefix + "-symmetry", layer.symmetry, defaults[prefix].symmetry);
        layer.texture = listed(prefix + "-texture", layer.texture, "streaks");
        layer.motion = listed(prefix + "-motion", layer.motion, "same");
        out[prefix] = layer;
      });
      return out;
    }

    function applySnapshot(snapshot) {
      const data = normalizeSnapshot(snapshot);
      applyGeneral(data);
      applyDefaults("layerA", data.layerA);
      applyDefaults("layerB", data.layerB);
      // A snapshot from before locks were recorded leaves the current
      // locks alone (on a fresh load, the defaults).
      if (Array.isArray(data.locks)) {
        const wanted = new Set(data.locks);
        document.querySelectorAll(".lock-btn").forEach((btn) => setLock(btn, wanted.has(btn.dataset.targetId)));
      }
      // Absent on every link and slot written before Motion existed,
      // which is exactly the "none" they were made with.
      const motion = document.getElementById("motion");
      motion.value = [...motion.options].some((o) => o.value === data.motion) ? data.motion : "none";
      render();
      syncSeamlessPreview({ auto: true });
    }

    // Converts a snapshot from an earlier STATE_VERSION (a shared link, a
    // saved slot) in place. Both v1 conversions are exact, so the picture
    // comes out cell-for-cell identical: scale in cells times block size
    // is the same scale in pixels, and strength over FIELD_GAIN times
    // FIELD_GAIN is the original multiplier (the slider's 0.005 step
    // holds a halved 0.01 value exactly). A scale beyond the slider's
    // range is clamped; at that size the field is flatter than the
    // canvas anyway.
    function upgradeState(data) {
      if (!data || (data.v || 1) >= STATE_VERSION) return data;
      const scaleMax = parseFloat(document.querySelector(".l-fieldScale, #layerA-fieldScale").max);
      ["layerA", "layerB"].forEach((key) => {
        const layer = data[key];
        if (!layer) return;
        layer.fieldScale = Math.min(scaleMax, layer.fieldScale * (data.blockSize || 1));
        layer.fieldStrength = layer.fieldStrength / FIELD_GAIN;
      });
      data.v = STATE_VERSION;
      return data;
    }

    // Chrome/Safari have no native "filled portion" pseudo-element for
    // range inputs (Firefox does: ::-moz-range-progress), so the fill is
    // faked with a track gradient driven by this --pct custom property.
    // Called from render() so it stays correct after every value change,
    // not just manual drags (randomize, presets, locks all just call
    // render() too, without necessarily dispatching an "input" event).
    function updateRangeFills() {
      document.querySelectorAll('input[type="range"]').forEach((el) => {
        const min = parseFloat(el.min) || 0;
        const max = parseFloat(el.max) || 100;
        const pct = ((parseFloat(el.value) - min) / (max - min || 1)) * 100;
        el.style.setProperty("--pct", pct);
      });
    }

    // Keeps each color swatch button in sync with its hidden native
    // <input type="color">, the actual value store. Called from render()
    // so it stays correct after every value change, not just picker
    // interactions (randomize, presets, saved states, and shared links
    // all just set .value directly, the same as updateRangeFills above).
    function updateColorSwatches() {
      document.querySelectorAll(".color-input-native").forEach((input) => {
        const swatch = input.closest(".color-picker").querySelector(".color-swatch");
        swatch.querySelector(".color-swatch-fill").style.background = input.value;
        swatch.querySelector(".color-swatch-hex").textContent = formatColorValue(input.value, colorFormat);
      });
    }

    // Split in two so a slider drag can refresh its label on every input
    // event (cheap, and the value tooltip reads it right away) while the
    // generate-and-draw half runs at most once per animation frame,
    // however many input events land in between.
    let pendingOptions = null;
    let renderFrame = 0;

    // A draw asked for here is the newest there is, so a frame a slider
    // still has waiting is dropped: it holds the settings as they were
    // when the slider moved, and landing after a Random it painted the
    // old picture over the new one. A PNG or SVG saved then was the
    // stale picture carrying the new one's link.
    // A page opened from a link keeps that link in the address bar, and
    // it used to stay there after every edit, so a reload or a copy
    // from the bar brought back the picture the link was opened with.
    // Once a link is applied, the bar follows the composition instead.
    // A plain visit is left alone: its address carries no picture.
    let addressCarriesLink = false;
    let addressTimer = 0;
    function syncAddressBar() {
      if (!addressCarriesLink) return;
      clearTimeout(addressTimer);
      addressTimer = setTimeout(() => {
        try {
          history.replaceState(history.state, "", stateUrl(snapshotForSharing()));
        } catch (err) {
          // A sandboxed frame can refuse; the bar is a convenience.
        }
      }, 400);
    }

    function render() {
      if (renderFrame) {
        cancelAnimationFrame(renderFrame);
        renderFrame = 0;
        pendingOptions = null;
      }
      drawComposition(prepareRender());
    }

    function scheduleRender() {
      pendingOptions = prepareRender();
      if (renderFrame) return;
      renderFrame = requestAnimationFrame(() => {
        renderFrame = 0;
        const options = pendingOptions;
        pendingOptions = null;
        drawComposition(options);
      });
    }

    function prepareRender() {
      syncAddressBar();
      updateShapeMaskDirectionUI();
      updateMotionUI();
      const options = readOptions();
      document.getElementById("blockSizeVal").textContent = options.blockSize + "px";
      document.getElementById("speedVal").textContent = formatSpeed(options.speed);
      document.getElementById("intervalVal").textContent = formatSpeed(options.interval);
      document.getElementById("depthVal").textContent = formatDepth(options.depth);
      document.getElementById("collideVal").textContent = options.collide > 0 ? options.collide.toFixed(1) : "off";
      updateLayerLabels("layerA", options.layerA);
      updateLayerLabels("layerB", options.layerB);
      updatePresetChips(options);
      updateRangeFills();
      updateColorSwatches();
      canvas.setAttribute(
        "aria-label",
        `Generated pixel art composition, ${options.width} by ${options.height}. ` +
          `Background ${options.bgColor}, layer A ${options.layerA.color} (seed ${options.layerA.seed}), ` +
          `layer B ${options.layerB.color} (seed ${options.layerB.seed}).`
      );
      return options;
    }

    function drawComposition(options) {
      // While an animated kind is previewing, a still draw (a slider
      // drag, Random, Undo) would flash the still between animation
      // frames; the preview reads the new settings on its next frame
      // instead. A GIF being recorded holds a still off the same way,
      // because the canvas is where its frames are drawn. PNG and SVG
      // stop the preview first so they always draw.
      if ((seamlessPreview.active || gifExporting) && options.loopPhase === undefined) {
        lastOptions = options;
        return;
      }
      const { gridA, gridB, cols, rows, warp } = generate(options);
      renderToCanvas(canvas, {
        width: options.width,
        height: options.height,
        blockSize: options.blockSize,
        bgColor: options.bgColor,
        colorA: options.layerA.color,
        colorB: options.layerB.color,
        gridA,
        gridB,
        cols,
        rows,
        warp,
      });
      lastResult = { gridA, gridB, cols, rows };
      lastOptions = options;
    }

    document.querySelector(".controls").addEventListener("input", scheduleRender);
    // A typed size past a cap already renders at the cap (readOptions
    // clamps it); snapping the fields on change keeps them from saying
    // 10000 over a canvas that is 8192. Both fields, because a size
    // over the area cap brings the other side down with it.
    function snapSizeFields(width, height) {
      const [w, h] = clampSize(width, height);
      document.getElementById("width").value = w;
      document.getElementById("height").value = h;
    }
    ["width", "height"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => {
        snapSizeFields(document.getElementById("width").value, document.getElementById("height").value);
      });
    });

    // Live preview of a motion: choosing anything but None in the
    // Motion field plays it on the canvas at the Speed slider's pace, so
    // the export is what's on screen; choosing None puts the still
    // back. Frames are picked by wall-clock time, so a
    // heavy composition drops frames rather than slowing the cycle.
    const seamlessPreview = { active: false, frame: 0 };
    // True while a moving GIF is being recorded. The export draws its
    // frames on this canvas one at a time, giving the page back in
    // between, so for its length a still draw is held off the same way
    // the preview holds one off (see drawComposition) and the preview
    // itself does not start. What changed is drawn when it ends.
    let gifExporting = false;
    // How long the first frame of a motion nobody picked on this visit
    // (a link's, a slot's) may take before the motion is held still
    // instead. The preview drops frames rather than slowing down, so a
    // frame this long means the tab does nothing but draw, back to
    // back. Half a second is well past what reads as motion and leaves
    // a slow phone room to play a default-size Ripple, which measures
    // about 100ms on a desktop.
    const AUTO_HOLD_FRAME_MS = 500;
    // Frames in one cycle of the tutorial's animated demo, which runs on
    // its own small canvas at a fixed size rather than off the beat.
    const CYCLE_FRAMES = 38;

    function currentCycleMs() {
      return speedMs(parseInt(speedInput.value, 10));
    }

    function currentIntervalMs() {
      return speedMs(parseInt(intervalInput.value, 10));
    }

    // The General tab's kind, or null for None. What generate() gets as
    // loopMode; each layer's own Motion is resolved against it there.
    function generalMotion() {
      const value = document.getElementById("motion").value;
      return value === "none" ? null : value;
    }

    // Whether anything is playing, and what to call it: the General
    // kind, or failing that the first layer running a kind of its own.
    function currentMotion() {
      const general = generalMotion();
      if (general) return general;
      for (const prefix of ["layerA", "layerB"]) {
        const own = document.getElementById(prefix + "-motion").value;
        if (own !== "same" && own !== "none") return own;
      }
      return null;
    }

    // What a GIF would record right now, read off the controls that
    // each own one axis: Motion says what a pass looks like, Speed says
    // how long an animated pass runs, Reroll every says how long a still
    // one is held, and the length menu says how many. They used to be
    // two menus with the kinds and the counts multiplied together into
    // one flat list, which is why choosing an animation quietly changed
    // the export and why the speed only applied to half the entries.
    //
    // A pass is one whole motion cycle whenever there is a motion, even
    // with Auto-randomize running on a different interval. That is the
    // one place the two durations have to be reconciled, and cutting a
    // cycle short at the reroll is the wrong way to do it: the seam that
    // makes an export loop is the cycle's own end.
    //
    // Passes only mean something when the composition changes between
    // them. Motion alone loops one composition, so the length is held at
    // one rather than emitting the same cycle several times over.
    function exportPlan() {
      const kind = currentMotion();
      const rerolls = !kind || !!autoplayTimer;
      const beats = rerolls ? parseInt(gifStepsSelect.value, 10) : 1;
      if (!kind) return { kind: null, beats, rerolls, frames: 1, delay: currentIntervalMs() };
      const cycleMs = currentCycleMs();
      // No one delay for a motion: frameDelay spreads the cycle over
      // its frames, so the plan carries the cycle and the frame count.
      return { kind, beats, rerolls, frames: beatFrames(beats, cycleMs, canvas.width * canvas.height), cycleMs };
    }

    const SEAMLESS_NAMES = { circle: "Loop", drift: "Drift", wind: "Wind", pulse: "Pulse", ripple: "Ripple", tide: "Tide" };

    function stopSeamlessPreview(redraw = true) {
      if (!seamlessPreview.active) return;
      cancelAnimationFrame(seamlessPreview.frame);
      seamlessPreview.active = false;
      seamlessPreview.frame = 0;
      if (redraw) render();
    }

    // `auto` is a motion the visitor did not ask for on this visit: a
    // shared link arriving with one. Someone who has asked their system
    // for reduced motion gets the still and the Motion menu still set,
    // so they can start it themselves if they want it. Picking a motion
    // by hand is that asking, and always plays.
    function prefersReducedMotion() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function syncSeamlessPreview({ auto = false } = {}) {
      const kind = currentMotion();
      stopSeamlessPreview(!kind);
      if (!kind) return;
      if (gifExporting) return;
      if (auto && prefersReducedMotion()) return;
      seamlessPreview.active = true;
      const start = performance.now();
      let lastStep = -1;
      // How many cycles have played, added up a tick at a time at the
      // beat in force then. The phase used to be the time since start
      // over the current beat, so moving Speed rescaled all of that time
      // at once and the picture jumped as far as a whole cycle.
      let cycles = 0;
      let last = start;
      const tick = (now) => {
        if (!seamlessPreview.active) return;
        const elapsed = now - start;
        // Redraws on a cadence cut from the cycle, not on the export's
        // frame count: the budget is an export concern, and a preview
        // throttled by it would stutter for no reason. Both the cadence
        // and the beat are read each tick, so the Speed slider takes
        // effect without a restart. A composition too heavy to keep up
        // drops frames rather than slowing the cycle down.
        const beat = currentCycleMs();
        cycles += Math.max(0, now - last) / beat;
        last = now;
        const cadence = Math.max(PREVIEW_MIN_FRAME_MS, Math.min(CYCLE_FRAME_MS, beat / PREVIEW_FRAMES_PER_CYCLE));
        const step = Math.floor(elapsed / cadence);
        if (step !== lastStep) {
          const first = lastStep === -1;
          lastStep = step;
          const phase = cycles % 1;
          const drawStart = performance.now();
          // The cycle count is for Ripple, whose drops land somewhere
          // new each time they are reborn on the canvas; exports leave
          // it out so their rain repeats and the loop closes.
          drawComposition(Object.assign(readOptions(), { loopMode: generalMotion() || "none", loopPhase: phase, loopCycle: Math.floor(cycles) }));
          // A link can carry a canvas this machine cannot animate. The
          // first frame says so, and the still goes back in place of a
          // tab that only draws. The Motion menu keeps what the link
          // set, as it does under reduced motion, and picking a motion
          // by hand still plays whatever the frame costs.
          if (auto && first && performance.now() - drawStart > AUTO_HOLD_FRAME_MS) {
            stopSeamlessPreview();
            showToast("Motion held, this canvas is slow to play");
            return;
          }
        }
        seamlessPreview.frame = requestAnimationFrame(tick);
      };
      seamlessPreview.frame = requestAnimationFrame(tick);
    }

    // A random hue at moderate saturation and a mid-to-dark lightness,
    // so a random background reads as a backdrop (something layer
    // colors show up against) rather than competing with them.
    // Best-of-N sampling shared by the background and layer color picks
    // below: draw up to `tries` candidates, keep the first that clears
    // every separation target (score >= 1), otherwise the closest miss.
    // Never loops forever on a range that can't satisfy a target; it
    // just returns the best that range can do.
    function bestOf(tries, draw, score) {
      let best = null;
      let bestScore = -Infinity;
      for (let i = 0; i < tries; i++) {
        const candidate = draw();
        const s = score(candidate);
        if (s > bestScore) {
          best = candidate;
          bestScore = s;
        }
        if (s >= 1) break;
      }
      return best;
    }

    // How far apart a roll tries to keep things, so three independently
    // random colors still read as three: layers at least this many
    // degrees of hue apart, and every layer this many lightness points
    // from the background.
    const MIN_HUE_SEPARATION = 35;
    const MIN_LIGHTNESS_SEPARATION = 20;
    const COLOR_TRIES = 24;

    // `avoidLightness`: lightness values (locked layer colors) the
    // background should stay clear of; empty on a fresh load.
    function randomBgColor(avoidLightness = []) {
      const pick = bestOf(
        COLOR_TRIES,
        () => [Math.random() * 360, 20 + Math.random() * 60, 8 + Math.random() * 35],
        ([, , l]) =>
          avoidLightness.length
            ? Math.min(...avoidLightness.map((other) => Math.abs(l - other) / MIN_LIGHTNESS_SEPARATION))
            : 1
      );
      return hslToHex(...pick);
    }

    // A layer's color, drawn from its own palette ranges but steered away
    // from the background's lightness and, when it makes sense, the other
    // layer's hue. Hue separation is skipped when the palette range can't
    // hold two hues that far apart (Earth tones) or hue barely shows at
    // all (Monochrome's saturation), so a deliberately narrow palette
    // still gets exactly what it asked for.
    function randomizeLayerColor(prefix) {
      const el = document.getElementById(prefix + "-color");
      const other = prefix === "layerA" ? "layerB" : "layerA";
      const bgL = hexToHsl(document.getElementById("bgColor").value).l;
      // Layer A is rolled before B, so A only avoids B's hue if B's color
      // is locked (otherwise B is about to move anyway and will avoid A).
      const otherIsFixed = prefix === "layerB" || lockedFields.has(other + "-color");
      const hueWidth = Math.abs(
        parseFloat(document.getElementById(prefix + "-hueMax").value) -
          parseFloat(document.getElementById(prefix + "-hueMin").value)
      );
      const satMax = parseFloat(document.getElementById(prefix + "-satMax").value);
      const otherHue =
        otherIsFixed && hueWidth >= MIN_HUE_SEPARATION * 2 && satMax >= 15
          ? hexToHsl(document.getElementById(other + "-color").value).h
          : null;
      const pick = bestOf(
        COLOR_TRIES,
        () => [randomInLayerRange(prefix, "hue"), randomInLayerRange(prefix, "sat"), randomInLayerRange(prefix, "light")],
        ([h, , l]) => {
          let score = Math.abs(l - bgL) / MIN_LIGHTNESS_SEPARATION;
          if (otherHue !== null) score = Math.min(score, hueDistance(h, otherHue) / MIN_HUE_SEPARATION);
          return score;
        }
      );
      el.value = hslToHex(...pick);
    }

    // Random's odds per option, so the strong, composition-dominating
    // looks (an 8-way kaleidoscope, a 3x3 wallpaper tile, any shape
    // mask) turn up as occasional surprises instead of one roll in
    // eight. Options not listed weigh 1.
    const SYMMETRY_WEIGHTS = { quad: 3, none: 3, horizontal: 2, vertical: 2, rotational: 2, diagonal: 1.5, kaleidoscope: 1, tile: 0.5 };
    const SHAPE_MASK_WEIGHTS = { none: 5 };
    // Streaks stays the house texture, weighted against the five others
    // put together, but not by so much that a few passes of Random never
    // turn one of them up.
    const TEXTURE_WEIGHTS = { streaks: 5 };
    const SELECT_WEIGHTS = { symmetry: SYMMETRY_WEIGHTS, texture: TEXTURE_WEIGHTS };

    function weightedPick(values, weights) {
      const total = values.reduce((sum, v) => sum + (weights[v] ?? 1), 0);
      let roll = Math.random() * total;
      for (const v of values) {
        roll -= weights[v] ?? 1;
        if (roll < 0) return v;
      }
      return values[values.length - 1];
    }

    // Log-uniform over the slider's range, so a roll favors the fine
    // grids the tool is built around (the median lands near 12px) while
    // the chunky end still shows up now and then. A uniform pick over
    // 2 to 80 would be a chunky 20px-plus grid three rolls in four.
    function randomLogRange(el) {
      const lo = Math.log(parseFloat(el.min));
      const hi = Math.log(parseFloat(el.max));
      el.value = Math.round(Math.exp(lo + Math.random() * (hi - lo)));
    }

    // Curated hue/saturation/lightness windows a layer's randomized color
    // is drawn from. "full" matches the original unconstrained defaults.
    const PALETTE_PRESETS = {
      full: { hueMin: 0, hueMax: 360, satMin: 55, satMax: 85, lightMin: 45, lightMax: 65 },
      pastel: { hueMin: 0, hueMax: 360, satMin: 25, satMax: 45, lightMin: 75, lightMax: 90 },
      neon: { hueMin: 0, hueMax: 360, satMin: 85, satMax: 100, lightMin: 50, lightMax: 60 },
      earth: { hueMin: 15, hueMax: 60, satMin: 35, satMax: 60, lightMin: 25, lightMax: 50 },
      mono: { hueMin: 0, hueMax: 360, satMin: 0, satMax: 8, lightMin: 15, lightMax: 85 },
    };

    function applyPalettePreset(prefix, presetKey) {
      const preset = PALETTE_PRESETS[presetKey];
      Object.keys(preset).forEach((key) => {
        document.getElementById(prefix + "-" + key).value = preset[key];
      });
      render();
    }

    // Web is the 1200x630 the document already opens at, so the chip is
    // lit on arrival rather than offering a size nothing starts on. It
    // is a wide canvas to work from, not a screen to fill: the
    // width field is free text, so anyone wanting 1080p or wider types
    // it, and nobody wanting a card-sized background has to shrink one.
    // Tablet is a real, recognizable resolution (iPad portrait). Both
    // divide evenly by most of the block size range.
    //
    // Mobile's old 375x812 (iPhone X) was both a narrower,
    // dated reference and the one preset that couldn't tile evenly at
    // any block size: 375 is odd, so no even block size divides it, and
    // 812 only shares factors with a handful of block sizes (2, 4, 7,
    // 14, 28). 400x800 keeps the same tall portrait proportions while
    // landing on a rounder, more current phone width and dividing
    // cleanly by every common block size (2, 4, 5, 8, 10, 16, 20, 25,
    // 40, 50, 80).
    // Tile's shapeMask/symmetry aren't dimension choices, they're what
    // actually make the output tile without a visible seam: "quad"
    // mirrors each layer's unique region across both axes, so a layer's
    // left edge always equals its right edge and its top edge always
    // equals its bottom edge, the exact property an image needs to
    // repeat cleanly. A shape mask breaks that (a centered circle doesn't repeat),
    // so Tile forces it off. 512 is a nice round, highly divisible size
    // for a texture swatch, not a specific device or screen to match.
    const DIMENSION_PRESETS = {
      web: { width: 1200, height: 630 },
      tablet: { width: 768, height: 1024 },
      mobile: { width: 400, height: 800 },
      tile: { width: 512, height: 512, shapeMask: "none", symmetry: "quad" },
    };

    document.querySelectorAll(".dimension-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = DIMENSION_PRESETS[btn.dataset.preset];
        document.getElementById("width").value = preset.width;
        document.getElementById("height").value = preset.height;
        if (preset.shapeMask) {
          document.getElementById("shapeMask").value = preset.shapeMask;
          setLock(document.querySelector('.lock-btn[data-for="shapeMask"]'), true);
        }
        if (preset.symmetry) {
          // Symmetry is one of RANDOMIZABLE_FIELDS, so without locking it
          // here too, the very next Random click would reroll each layer
          // onto some other symmetry and silently break the seam this
          // preset just set up.
          document.getElementById("layerA-symmetry").value = preset.symmetry;
          document.getElementById("layerB-symmetry").value = preset.symmetry;
          setLock(document.querySelector('#tab-layerA .lock-btn[data-for="symmetry"]'), true);
          setLock(document.querySelector('#tab-layerB .lock-btn[data-for="symmetry"]'), true);
          // The lock icons alone are easy to miss on a tab that isn't open
          // (both layer tabs, in this case), same reasoning as the other
          // toasts below.
          showToast("Shape mask and symmetry locked");
        }
        render();
      });
    });

    // Lights a preset chip while the current values still match it,
    // derived from state rather than from the click: Web is lit however
    // the size came to be 1200x630, Tile only while the size is square
    // with no mask and both layers on 4-way mirror, and a palette chip
    // only while all six of its ranges still hold. Nudge anything and
    // the chip goes quiet on its own.
    function updatePresetChips(options) {
      document.querySelectorAll(".dimension-preset-btn").forEach((btn) => {
        const preset = DIMENSION_PRESETS[btn.dataset.preset];
        const active =
          options.width === preset.width &&
          options.height === preset.height &&
          (!preset.shapeMask || options.shapeMask === preset.shapeMask) &&
          (!preset.symmetry ||
            (options.layerA.symmetry === preset.symmetry && options.layerB.symmetry === preset.symmetry));
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
      ["layerA", "layerB"].forEach((prefix) => {
        const layer = options[prefix];
        document.querySelectorAll(`#tab-${prefix} .palette-preset-btn`).forEach((btn) => {
          const preset = PALETTE_PRESETS[btn.dataset.preset];
          const active = Object.keys(preset).every((key) => layer[key] === preset[key]);
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-pressed", String(active));
        });
      });
    }

    // Randomizes one field's DOM element in place, respecting its own
    // type/range so every control (slider, select, color, text) gets a
    // sensible random value without field-specific randomize code.
    // Draws a random value between the layer's own <fieldName>Min/Max
    // range controls (order-independent, so a min dragged past its max
    // still yields a valid range instead of a negative span).
    function randomInLayerRange(prefix, name) {
      const a = parseFloat(document.getElementById(prefix + "-" + name + "Min").value);
      const b = parseFloat(document.getElementById(prefix + "-" + name + "Max").value);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return lo + Math.random() * (hi - lo);
    }

    function randomizeRangeInput(el) {
      const min = parseFloat(el.min);
      const max = parseFloat(el.max);
      const step = parseFloat(el.step) || 1;
      const steps = Math.round((max - min) / step);
      el.value = min + Math.floor(Math.random() * (steps + 1)) * step;
    }

    function randomizeElement(prefix, field) {
      const el = document.getElementById(prefix + "-" + field);
      if (field === "seed") {
        el.value = Math.random().toString(36).slice(2, 10);
      } else if (field === "color") {
        randomizeLayerColor(prefix);
      } else if (field === "density") {
        el.value = randomInLayerRange(prefix, "density");
      } else if (field === "fieldScale") {
        randomLogRange(el);
      } else if (el.tagName === "SELECT") {
        const options = Array.from(el.options).map((o) => o.value);
        el.value = weightedPick(options, SELECT_WEIGHTS[field] || {});
      } else {
        randomizeRangeInput(el);
      }
    }

    // Keeps the full state from just before each randomize pass. Manual
    // clicks and autoplay ticks each record one; a GIF export records
    // one for the whole run rather than one per frame, since what you
    // want back afterwards is the composition you had before the export,
    // not its thirteenth intermediate step.
    //
    // At the 2s default a twenty-deep stack was forty seconds of
    // autoplay, which is nothing. A hundred entries of a small options
    // object costs little and covers a few minutes.
    const MAX_UNDO_HISTORY = 100;
    const undoHistory = [];
    const undoBtn = document.getElementById("undoBtn");

    // UNDO_SHORTCUT is set by the inline script under the site footer.
    undoBtn.title = `Undo last randomize (${UNDO_SHORTCUT})`;

    function updateUndoButton() {
      undoBtn.disabled = undoHistory.length === 0;
    }

    function recordUndoState() {
      undoHistory.push(readOptions());
      // Evicts the second-oldest, not the oldest. Index 0 is where the
      // session began, and dropping that first is exactly backwards:
      // it's the one point someone is most likely to want back after a
      // long run of passes has carried them somewhere else.
      if (undoHistory.length > MAX_UNDO_HISTORY) undoHistory.splice(1, 1);
      updateUndoButton();
    }

    // record=false for the passes inside a GIF export, which records
    // its own single entry before the run starts.
    function performRandomize(record = true) {
      if (record) recordUndoState();

      // Background first, so each layer's color can be steered clear of
      // it (see randomizeLayerColor). If the background is unlocked it
      // in turn steers clear of any layer color that is locked.
      if (!lockedFields.has("bgColor")) {
        const lockedLayerLightness = ["layerA", "layerB"]
          .filter((prefix) => lockedFields.has(prefix + "-color"))
          .map((prefix) => hexToHsl(document.getElementById(prefix + "-color").value).l);
        document.getElementById("bgColor").value = randomBgColor(lockedLayerLightness);
      }
      ["layerA", "layerB"].forEach((prefix) => {
        RANDOMIZABLE_FIELDS.forEach((field) => {
          if (!lockedFields.has(prefix + "-" + field)) randomizeElement(prefix, field);
        });
      });
      if (!lockedFields.has("blockSize")) {
        randomLogRange(document.getElementById("blockSize"));
      }
      if (!lockedFields.has("shapeMask")) {
        const el = document.getElementById("shapeMask");
        const opts = Array.from(el.options).map((o) => o.value);
        el.value = weightedPick(opts, SHAPE_MASK_WEIGHTS);
        // Direction rides along with the shape mask under one lock rather
        // than getting its own, so a landed-on corner/side/stripe reads
        // as a full reroll instead of always defaulting to the same
        // first option in its list.
        updateShapeMaskDirectionUI();
        const dirSelect = document.getElementById("shapeMaskDirection");
        const dirOpts = Array.from(dirSelect.options).map((o) => o.value);
        if (dirOpts.length) dirSelect.value = dirOpts[Math.floor(Math.random() * dirOpts.length)];
      }
      render();
    }

    document.getElementById("randomizeBtn").addEventListener("click", () => performRandomize());

    undoBtn.addEventListener("click", () => {
      const previous = undoHistory.pop();
      if (!previous) return;
      // Undo takes back a reroll, so it puts back what a pass rerolls
      // (the background, the block size, the shape mask and each
      // layer's randomizable fields) and leaves everything else as it
      // is now. Restoring the whole snapshot also threw away a width
      // typed, a Speed dragged or a palette range narrowed since then.
      const now = readOptions();
      const restored = Object.assign(now, {
        bgColor: previous.bgColor,
        blockSize: previous.blockSize,
        shapeMask: previous.shapeMask,
        shapeMaskDirection: previous.shapeMaskDirection,
      });
      ["layerA", "layerB"].forEach((prefix) => {
        RANDOMIZABLE_FIELDS.forEach((field) => { restored[prefix][field] = previous[prefix][field]; });
      });
      // Auto-randomize would replace the restored picture at its next
      // tick, so stepping back stops it.
      const wasAutoplaying = !!autoplayTimer;
      if (wasAutoplaying) stopAutoplay();
      applyGeneral(restored);
      applyDefaults("layerA", restored.layerA);
      applyDefaults("layerB", restored.layerB);
      render();
      updateUndoButton();
      showToast(wasAutoplaying ? "Stepped back, Auto-randomize stopped" : "Stepped back");
    });

    // A brief confirmation for actions whose effect might not be visible
    // from whichever tab is currently open (Lock All, for instance,
    // changes lock icons that could be sitting on a layer tab that
    // isn't the one on screen right now).
    const toast = document.getElementById("toast");
    let toastTimer = null;
    function showToast(message) {
      toast.textContent = message;
      toast.classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("visible"), 2000);
    }

    document.getElementById("lockAllBtn").addEventListener("click", () => {
      document.querySelectorAll(".lock-btn").forEach((btn) => setLock(btn, true));
      showToast("All fields locked");
    });
    document.getElementById("unlockAllBtn").addEventListener("click", () => {
      document.querySelectorAll(".lock-btn").forEach((btn) => setLock(btn, false));
      showToast("All fields unlocked");
    });

    // Auto-randomize: calls performRandomize, then schedules the next
    // call. One tick at a time rather than a setInterval, because the
    // wait has to be re-read whenever the Reroll every slider moves.
    // The restart that used to do that was bound to the wrong slider:
    // dragging Speed reset the reroll clock and dragging the interval
    // did nothing at all until Play was stopped and started again.
    const playBtn = document.getElementById("playBtn");
    let autoplayTimer = null;

    // The selects left in split buttons show only a caret at rest (see
    // .split-btn-select in style.css), so the current value is surfaced
    // as a tooltip instead.
    function syncSelectTitle(select, baseTitle) {
      select.title = `${baseTitle} (currently ${select.options[select.selectedIndex].text})`;
    }
    const gifStepsSelect = document.getElementById("gifSteps");
    const linkModeSelect = document.getElementById("linkMode");
    const motionSelect = document.getElementById("motion");
    // Short on purpose. A title is not the place to teach a feature, and
    // it can't be: it never appears on a touch device at all, so anything
    // load-bearing in here is invisible to half the people using this.
    // The tour and the guide carry the explanations. What earns its place
    // is the current value, which syncSelectTitle appends, because these
    // selects render as a bare caret.
    const GIF_MENU_TITLE = "How many passes the GIF records";
    syncSelectTitle(gifStepsSelect, GIF_MENU_TITLE);
    syncSelectTitle(linkModeSelect, "What the link offers when opened");
    linkModeSelect.addEventListener("change", () => syncSelectTitle(linkModeSelect, "What the link offers when opened"));
    gifStepsSelect.addEventListener("change", () => syncSelectTitle(gifStepsSelect, GIF_MENU_TITLE));

    // Motion is the only one of the three that changes what's on screen
    // the moment it's set, so it's the one that says so.
    motionSelect.addEventListener("change", () => {
      // General is the master: choosing a kind here puts both layers
      // back to following it. A layer set to its own kind would
      // otherwise keep it, and General would look dead for that layer.
      // None takes nothing back: it stops what General was playing,
      // and a layer that runs its own kind goes on running it.
      const general = motionSelect.value;
      if (general !== "none") {
        ["layerA", "layerB"].forEach((prefix) => {
          document.getElementById(prefix + "-motion").value = "same";
        });
      }
      // Also called from prepareRender, but that is a frame away behind
      // scheduleRender, and the select's own change is the moment the
      // Speed slider should be there or gone.
      updateMotionUI();
      const wasPreviewing = seamlessPreview.active;
      syncSeamlessPreview();
      const kind = currentMotion();
      const ownKinds = ["layerA", "layerB"]
        .map((prefix) => [prefix === "layerA" ? "Layer A" : "Layer B", document.getElementById(prefix + "-motion").value])
        .filter(([, own]) => own !== "same" && own !== "none");
      if (general === "none" && ownKinds.length) {
        showToast(`General off, ${ownKinds.map(([name, own]) => `${name} plays ${SEAMLESS_NAMES[own]}`).join(", ")}`);
      } else if (kind) showToast(`Playing ${SEAMLESS_NAMES[kind]}`);
      else if (wasPreviewing) showToast("Motion off");
    });

    // A layer's own Motion starts or stops the preview the same way,
    // and its toast names the layer and what it now does rather than
    // whatever General happens to say.
    ["layerA", "layerB"].forEach((prefix) => {
      const select = document.getElementById(prefix + "-motion");
      const name = prefix === "layerA" ? "Layer A" : "Layer B";
      select.addEventListener("change", () => {
        updateMotionUI();
        const wasPreviewing = seamlessPreview.active;
        syncSeamlessPreview();
        const own = select.value;
        if (own === "same") showToast(seamlessPreview.active ? `${name} follows General` : wasPreviewing ? "Motion off" : `${name} follows General`);
        else if (own === "none") showToast(seamlessPreview.active ? `${name} holds still` : wasPreviewing ? "Motion off" : `${name} holds still`);
        else showToast(`${name} plays ${SEAMLESS_NAMES[own]}`);
      });
    });

    function stopAutoplay() {
      clearTimeout(autoplayTimer);
      autoplayTimer = null;
      playBtn.classList.remove("playing");
      setIcon(playBtn.querySelector("i"), "play");
      playBtn.title = "Auto-randomize (Space)";
    }

    // `immediate` (the default, for the button and Space) rerolls at once
    // so the click has a visible result; a shared link that opens
    // playing passes false, so its composition shows first and the
    // first reroll lands one interval later.
    // When the current wait began. Kept apart from the scheduling so a
    // wait can be re-timed against the new interval without restarting
    // it: moving the slider from eight seconds to a half should reroll
    // about half a second in, not eight, and a drag that re-times on
    // every input event must not push the tick away each time it does.
    let rerollWaitFrom = 0;

    // `fresh` starts a new wait; without it the wait already running is
    // measured against the interval as it now stands, and fires at once
    // if that has already gone by.
    function scheduleReroll(fresh) {
      if (fresh) rerollWaitFrom = performance.now();
      const remaining = Math.max(0, currentIntervalMs() - (performance.now() - rerollWaitFrom));
      clearTimeout(autoplayTimer);
      autoplayTimer = setTimeout(() => {
        performRandomize();
        // A pass can stop playback itself (a GIF export does), and the
        // id is still the fired timeout's until it is reassigned, so
        // this asks whether anything cleared it rather than assuming.
        if (autoplayTimer) scheduleReroll(true);
      }, remaining);
    }

    intervalInput.addEventListener("input", () => {
      if (autoplayTimer) scheduleReroll(false);
    });

    function startAutoplay(immediate = true) {
      playOffer.hidden = true;
      if (immediate) performRandomize();
      scheduleReroll(true);
      playBtn.classList.add("playing");
      setIcon(playBtn.querySelector("i"), "pause");
      playBtn.title = "Stop auto-randomize (Space)";
    }

    // Every way of starting playback by hand comes through here: the
    // Play button, Space (which clicks it), and the prompt on a link
    // that offers to play. While that prompt is up the link's motion is
    // being held for the answer, and starting playback is the answer
    // whichever control gives it. Play and Space used to dismiss the
    // prompt and start the rerolls without the motion the link carried.
    function startPlayback() {
      if (!playOffer.hidden) syncSeamlessPreview();
      startAutoplay();
    }

    playBtn.addEventListener("click", () => {
      if (autoplayTimer) stopAutoplay();
      else startPlayback();
    });

    // The prompt a recipient sees on a link marked "Offers to play"
    // (see loadStateFromURL). Playing from it rerolls at once, like the
    // Play button, since that is the author's variations they came for.
    const playOffer = document.getElementById("playOffer");
    // Both halves of what the link offered: the motion it was made
    // with, and the rerolls on top of it.
    document.getElementById("playOfferStartBtn").addEventListener("click", startPlayback);
    document.getElementById("playOfferDismissBtn").addEventListener("click", () => {
      playOffer.hidden = true;
    });

    // PNG and SVG capture the still: a running preview is stopped (which
    // redraws the still) and picked up again afterwards. Picked up, not
    // started: a motion held still (for reduced motion, behind the play
    // offer, on a canvas too slow to play) was being set going by the
    // export, which nobody asked of a download button.
    //
    // Every file leaves through saveBlob. The address is given back a
    // second later, not on the next line: the click only starts the
    // download, and a browser that has not opened the blob yet finds
    // it gone.
    function saveBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // toBlob, not toDataURL: a data URL is the whole file as base64 in
    // a string, built while the page waits, and at the largest canvas
    // that is tens of megabytes in an href. The blob is encoded off the
    // main thread. The preview is picked up once the file is in hand,
    // so nothing draws over the still while it is being read.
    document.getElementById("downloadPng").addEventListener("click", () => {
      const wasPreviewing = seamlessPreview.active;
      stopSeamlessPreview();
      const filename = `${lastOptions.layerA.seed}.png`;
      canvas.toBlob((blob) => {
        if (blob) saveBlob(blob, filename);
        else showToast("Couldn't make the PNG");
        if (wasPreviewing) syncSeamlessPreview();
      }, "image/png");
    });

    document.getElementById("downloadSvg").addEventListener("click", () => {
      const wasPreviewing = seamlessPreview.active;
      stopSeamlessPreview();
      const svg = gridToSVG({
        width: lastOptions.width,
        height: lastOptions.height,
        blockSize: lastOptions.blockSize,
        bgColor: lastOptions.bgColor,
        colorA: lastOptions.layerA.color,
        colorB: lastOptions.layerB.color,
        gridA: lastResult.gridA,
        gridB: lastResult.gridB,
        cols: lastResult.cols,
        rows: lastResult.rows,
        // Provenance, not a watermark: nothing is drawn, and an SVG that
        // gets optimized on its way somewhere loses it without harm. What
        // it buys is a file you can reopen a year later. Always the plain
        // still link, whatever the share menu is set to.
        source: stateUrl(snapshotForSharing()),
      });
      saveBlob(new Blob([svg], { type: "image/svg+xml" }), `${lastOptions.layerA.seed}.svg`);
      if (wasPreviewing) syncSeamlessPreview();
    });

    // The GIF encoder is only needed by the export below, which most
    // visits never touch; loading it here on first use instead of
    // unconditionally in <head> keeps it off the initial render path.
    // It is the project's own file, so it carries a ?v= like the
    // generator does and CI holds the number to the file.
    let gifWriterPromise = null;
    function loadGifWriter() {
      if (window.createGifWriter) return Promise.resolve();
      if (!gifWriterPromise) {
        gifWriterPromise = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "gif-writer.js?v=1";
          script.onload = resolve;
          script.onerror = () => {
            gifWriterPromise = null;
            reject(new Error("Failed to load gif-writer.js"));
          };
          document.body.appendChild(script);
        });
      }
      return gifWriterPromise;
    }

    // Builds an animated GIF from the composition on screen, then one
    // performRandomize() per pass after the first (so extra passes
    // respect the same field locks as manual randomizing). A moving
    // pass lasts one cycle of the Speed slider and a still one is held
    // for the Reroll every interval, so total GIF length is that times
    // the passes.
    //
    // A moving export is recorded a frame at a time with the page given
    // back in between. One pass on the default canvas is 168 frames,
    // and drawing them in one go froze the tab for as long as it took,
    // with a spinner that could not turn. So the button counts up
    // instead, and three things are held for the length of it: still
    // draws and the preview (gifExporting), Auto-randomize, and the two
    // exports that read the canvas, which would save whichever frame
    // happened to be on it.
    const downloadGifBtn = document.getElementById("downloadGif");
    const stillExportBtns = [document.getElementById("downloadPng"), document.getElementById("downloadSvg")];

    function saveGif(writer, name) {
      saveBlob(new Blob(writer.finish(), { type: "image/gif" }), `${name}.gif`);
    }

    downloadGifBtn.addEventListener("click", async () => {
      // Read before anything is stopped: the plan asks whether
      // Auto-randomize is running, and the first frame is the
      // composition on screen now, not the one a reroll would bring
      // while the encoder loads.
      const plan = exportPlan();
      const kind = plan.kind;
      const frames = plan.frames;
      const wasPreviewing = seamlessPreview.active;
      const wasAutoplaying = !!autoplayTimer;
      const seedForFilename =
        lastOptions.layerA.seed +
        (kind ? "-" + kind : "") +
        (plan.rerolls && plan.beats > 1 ? "-x" + plan.beats : "");

      stopSeamlessPreview();
      if (wasAutoplaying) stopAutoplay();
      downloadGifBtn.disabled = true;
      downloadGifBtn.setAttribute("aria-busy", "true");
      // A spinner while the wait has no length: the encoder loading,
      // or a handful of stills. It is the same size as the icon it
      // replaces, so nothing in the row moves.
      downloadGifBtn.innerHTML = iconTag("spinner-gap") + " GIF";

      try {
        try {
          await loadGifWriter();
        } catch (err) {
          showToast("Couldn't load the GIF encoder");
          return;
        }
        const ctx = canvas.getContext("2d");
        const pixelsOf = (width, height) => new Uint32Array(ctx.getImageData(0, 0, width, height).data.buffer);

        if (!kind) {
          // Stills: the composition on screen is the first frame and the
          // rerolls after it share one undo entry, so undoing after an
          // export lands on the composition you exported from. A lone
          // pass is that composition and nothing else, so it makes no
          // entry at all. A handful of frames at most, so nothing is
          // held and nothing counts up.
          const writer = createGifWriter(canvas.width, canvas.height);
          if (plan.beats > 1) recordUndoState();
          for (let i = 0; i < plan.beats; i++) {
            if (i) performRandomize(false);
            writer.addFrame(pixelsOf(canvas.width, canvas.height), plan.delay);
          }
          saveGif(writer, seedForFilename);
          // Motion opens at None, so a first GIF is one still frame,
          // and a file that does not move reads as a broken export.
          if (plan.beats === 1) showToast("Still GIF. Pick a Motion to animate it.");
          return;
        }

        // One Auto-randomize pass per segment, each animated through
        // exactly one cycle of the kind, then a cut to the next pass,
        // the way the canvas looks with Auto-randomize running. Motion
        // alone is one pass: every setting and both seeds hold and only
        // the phase advances, so frame 0 is the still on screen and the
        // frame after the last would be frame 0 again.
        //
        // The first pass is the composition on screen, since that is
        // what Auto-randomize is showing when the button is pressed and
        // it rerolls at the end of an interval, not the start. The
        // rerolls are a single entry on the undo stack, not one per
        // pass, and a lone pass makes no entry at all because it
        // changes nothing.
        //
        // The size and the motion are read once. A reroll does not
        // change either, but the page is live between frames, and a
        // width typed halfway through would otherwise arrive in the
        // next pass as a frame the file has no room for.
        gifExporting = true;
        stillExportBtns.forEach((btn) => { btn.disabled = true; });
        // From here the wait has a length, so the spinner gives way to
        // a count, and the count is the only thing in the button. It
        // used to sit beside the spinner, where "100%" is wider than
        // "GIF": the button grew and shrank with every digit, and PNG
        // and SVG, which share what the GIF button leaves, moved with
        // it. Alone, the widest count is narrower than the icon and
        // "GIF" together, so the button is held at the width it has
        // now and the row stays as it is at rest.
        downloadGifBtn.style.minWidth = `${downloadGifBtn.getBoundingClientRect().width}px`;
        downloadGifBtn.textContent = "0%";
        const first = readOptions();
        const loopMode = generalMotion() || "none";
        const writer = createGifWriter(first.width, first.height);
        const total = plan.beats * frames;
        if (plan.beats > 1) recordUndoState();
        for (let pass = 0; pass < plan.beats; pass++) {
          if (pass) performRandomize(false);
          const options = pass ? Object.assign(readOptions(), { width: first.width, height: first.height }) : first;
          for (let i = 0; i < frames; i++) {
            drawComposition(Object.assign({}, options, { loopMode, loopPhase: framePhase(i, frames, plan.cycleMs) }));
            writer.addFrame(pixelsOf(first.width, first.height), frameDelay(i, frames, plan.cycleMs));
            downloadGifBtn.textContent = Math.floor((100 * (pass * frames + i + 1)) / total) + "%";
            // A timer rather than an animation frame, which a hidden
            // tab stops delivering: the export would wait there until
            // someone came back to look at it.
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        saveGif(writer, seedForFilename);
      } catch (err) {
        // Whatever it was (a canvas too large to read back, a frame the
        // encoder refused), the button must not be left spinning.
        console.error(err);
        showToast("Couldn't make the GIF");
      } finally {
        gifExporting = false;
        stillExportBtns.forEach((btn) => { btn.disabled = false; });
        downloadGifBtn.disabled = false;
        downloadGifBtn.removeAttribute("aria-busy");
        downloadGifBtn.style.minWidth = "";
        downloadGifBtn.innerHTML = iconTag("download-simple") + " GIF";
        // The canvas is on the last frame recorded. Put the still back,
        // then whatever was running when the button was pressed.
        render();
        if (wasPreviewing) syncSeamlessPreview();
        if (wasAutoplaying) startAutoplay(false);
      }
    });

    // Save-state slots: each stores the full readOptions() snapshot
    // (canvas settings + both layers, not lock states) in localStorage
    // so slots survive a page reload.
    const PRESET_KEY_PREFIX = "featuregen-preset-";

    // Every slot read and write goes through here. With site data
    // blocked, or in a sandboxed frame, reading the localStorage
    // property itself throws, and the read that fills in the slot rows
    // runs at load: unguarded, it took the rest of the script with it,
    // so the canvas stayed blank and a link was never read. A slot that
    // cannot be read is an empty one, and a write says whether it took.
    //
    // A read hands back the snapshot, parsed, or null. What is stored
    // under the key is only a string, and anything can be in it: text
    // that is not JSON, or JSON of the wrong shape (a number, an object
    // with no layers). The row used to parse it one way and Load
    // another, so a slot holding `5` showed as saved, enabled Load, and
    // Load threw. Both layers present is what makes it a composition.
    const slotStore = {
      read(slot) {
        let data = null;
        try { data = JSON.parse(localStorage.getItem(PRESET_KEY_PREFIX + slot)); } catch (err) { return null; }
        const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
        return isObject(data) && isObject(data.layerA) && isObject(data.layerB) ? data : null;
      },
      write(slot, value) {
        try { localStorage.setItem(PRESET_KEY_PREFIX + slot, value); return true; } catch (err) { return false; }
      },
    };

    function applyGeneral(values) {
      // Absent from every slot and link written while the beat was a
      // five-entry menu that only travelled with an autoplay flag; those
      // carry it as `autoplay` instead, which decodeCompact copies into
      // both, since one number is what it meant by both.
      if (values.speed) {
        speedInput.value = Math.max(parseInt(speedInput.min, 10) || 0, speedStep(values.speed));
      }
      // The interval slider only stops on multiples of its step, so a
      // value between two of them is rounded here rather than left to
      // the browser to clamp downward without saying so. A link written
      // when the beat was one five-entry menu can carry 3s or 10s,
      // neither of which is a stop.
      if (values.interval) {
        const lo = parseInt(intervalInput.min, 10) || 0;
        const step = parseInt(intervalInput.step, 10) || 1;
        intervalInput.value = Math.max(lo, Math.round(speedStep(values.interval) / step) * step);
      }
      // Absent from every slot and link written before these existed,
      // and what those meant is the default, so absent resets rather
      // than leaving whatever was set.
      depthInput.value = values.depth > 0 ? depthIndex(values.depth) : DEPTH_DEFAULT_INDEX;
      directionSelect.value = values.direction === "reverse" ? "reverse" : "forward";
      collideInput.value = values.collide > 0 ? Math.min(10, Math.round(values.collide * 10)) : 0;
      document.getElementById("bgColor").value = values.bgColor;
      snapSizeFields(values.width, values.height);
      document.getElementById("blockSize").value = values.blockSize;
      document.getElementById("shapeMask").value = values.shapeMask || "none";
      // Rebuild the direction options for the restored shape now, rather
      // than leaving it to render()'s own call further down the line:
      // that way the specific direction below is set on options that
      // already match, instead of getting reset back to the first one
      // the moment render() notices the shape type changed.
      updateShapeMaskDirectionUI();
      const dirSelect = document.getElementById("shapeMaskDirection");
      const hasDirection = [...dirSelect.options].some((o) => o.value === values.shapeMaskDirection);
      if (hasDirection) dirSelect.value = values.shapeMaskDirection;
    }

    // "2:14 PM" for a same-day save, otherwise "Sep 3"; a slot written
    // before savedAt existed just says "saved".
    function formatSavedAt(ts) {
      if (!ts) return "saved";
      const d = new Date(ts);
      const sameDay = d.toDateString() === new Date().toDateString();
      return sameDay
        ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    function refreshPresetUI(slot) {
      const data = slotStore.read(slot);
      const row = document.querySelector(`.preset-row[data-slot="${slot}"]`);
      const swatches = row.querySelector(".preset-swatches");
      // The three colors are what make one slot recognizable next to
      // another; nothing else in the snapshot is glanceable.
      swatches.replaceChildren();
      if (data) {
        [data.bgColor, data.layerA?.color, data.layerB?.color]
          .filter(Boolean)
          .forEach((color) => {
            const band = document.createElement("i");
            band.style.background = color;
            swatches.appendChild(band);
          });
      }
      row.querySelector(".preset-status").textContent = data ? formatSavedAt(data.savedAt) : "empty";
      row.querySelector(".preset-load-btn").disabled = !data;
      // An empty slot has nothing to lose, so the first save into one is
      // a plain press; once it holds something, saving means overwriting
      // a composition that outlives the tab, and that wants the hold.
      const saveBtn = row.querySelector(".preset-save-btn");
      if (data) {
        saveBtn.dataset.hold = `Hold to overwrite Slot ${slot}`;
        saveBtn.title = `Overwrite Slot ${slot} with the current state`;
      } else {
        delete saveBtn.dataset.hold;
        saveBtn.title = `Save current state to Slot ${slot}`;
      }
    }

    document.querySelectorAll(".preset-save-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const snapshot = Object.assign(snapshotForSharing(), { savedAt: Date.now() });
        if (!slotStore.write(btn.dataset.slot, JSON.stringify(snapshot))) {
          showToast("Couldn't save: storage is blocked or full");
          return;
        }
        refreshPresetUI(btn.dataset.slot);
        showToast(`Saved to Slot ${btn.dataset.slot}`);
      });
    });

    document.querySelectorAll(".preset-load-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const data = slotStore.read(btn.dataset.slot);
        if (!data) return;
        applySnapshot(upgradeState(data));
        showToast(`Loaded Slot ${btn.dataset.slot}`);
      });
    });

    [1, 2, 3].forEach(refreshPresetUI);

    // Floating value tooltip that tracks each range input's thumb while
    // dragging. Reads its text from the slider's existing pill (<span> in
    // its label), deferred via requestAnimationFrame so it reads AFTER
    // the delegated render()/updateLayerLabels() call (attached earlier,
    // on ".controls") has already refreshed that text for this event.
    function initSliderTooltips() {
      document.querySelectorAll('input[type="range"]').forEach((input) => {
        const wrap = document.createElement("div");
        wrap.className = "slider-wrap";
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);

        const tooltip = document.createElement("div");
        tooltip.className = "slider-tooltip";
        wrap.appendChild(tooltip);

        // The value pill by name, not by being the only span in the
        // label: some labels carry a name span too, whose text changes
        // with the layer's texture, and that one sits first.
        const valueSpan = input.closest(".field")?.querySelector("label .field-value");

        function positionTooltip() {
          const min = parseFloat(input.min) || 0;
          const max = parseFloat(input.max) || 100;
          const pct = (parseFloat(input.value) - min) / (max - min || 1);
          const thumbWidth = 14;
          const trackWidth = input.offsetWidth;
          const left = pct * (trackWidth - thumbWidth) + thumbWidth / 2;
          tooltip.style.left = left + "px";
          tooltip.textContent = valueSpan ? valueSpan.textContent : input.value;
        }

        function showTooltip() {
          positionTooltip();
          tooltip.classList.add("visible");
        }

        input.addEventListener("pointerdown", showTooltip);
        input.addEventListener("input", () => {
          showTooltip();
          requestAnimationFrame(positionTooltip);
        });
        input.addEventListener("keydown", showTooltip);
        input.addEventListener("pointerup", () => {
          setTimeout(() => tooltip.classList.remove("visible"), 500);
        });
        input.addEventListener("blur", () => tooltip.classList.remove("visible"));
      });
    }
    initSliderTooltips();

    // Renders a fresh favicon on every page load using the same
    // generate()/renderToCanvas() pipeline as the main artwork, just at a
    // tiny size with its own random layer parameters, but the same three
    // colors as the main artwork, so the browser-tab icon reads as a
    // miniature of what's on screen. The static favicon.svg in <head> is
    // what shows before this runs, so there's no flash of a missing icon.
    function generateRandomFavicon() {
      const size = 64;
      const blockSize = 8;
      const symmetryOptions = ["quad", "kaleidoscope", "diagonal", "rotational", "horizontal", "vertical"];
      const bgColor = document.getElementById("bgColor").value;
      const colorA = document.getElementById("layerA-color").value;
      const colorB = document.getElementById("layerB-color").value;
      const randomLayer = (color) => ({
        seed: Math.random().toString(36).slice(2),
        color,
        density: 0.3 + Math.random() * 0.3,
        fieldStrength: 0,
        fieldScale: 320,
        flowAngle: 0,
        flowStretch: 1,
        fieldOctaves: 1,
        symmetry: symmetryOptions[Math.floor(Math.random() * symmetryOptions.length)],
        smoothPasses: 0,
      });

      const options = {
        width: size,
        height: size,
        blockSize,
        bgColor,
        layerA: randomLayer(colorA),
        layerB: randomLayer(colorB),
      };

      const { gridA, gridB, cols, rows } = generate(options);
      const faviconCanvas = document.createElement("canvas");
      renderToCanvas(faviconCanvas, {
        width: size,
        height: size,
        blockSize,
        bgColor: options.bgColor,
        colorA: options.layerA.color,
        colorB: options.layerB.color,
        gridA,
        gridB,
        cols,
        rows,
      });

      document.querySelector('link[rel="icon"]').href = faviconCanvas.toDataURL("image/png");
    }

    // Below the layout's mobile breakpoint, the sidebar becomes a
    // sheet over the bottom of the screen (see the .sidebar-toggle /
    // .controls rules in style.css) instead of a permanent column.
    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebarBackdrop = document.getElementById("sidebarBackdrop");

    function sheetShowing() {
      if (!document.body.classList.contains("sidebar-open")) return null;
      return document.body.classList.contains("sheet-export") ? "export" : "settings";
    }

    function syncSheetButtons() {
      const showing = sheetShowing();
      sidebarToggle.classList.toggle("is-active", showing === "settings");
      barExportBtn.classList.toggle("is-active", showing === "export");
      sidebarToggle.setAttribute("aria-pressed", String(showing === "settings"));
      barExportBtn.setAttribute("aria-pressed", String(showing === "export"));
      sidebarToggle.title = showing === "settings" ? "Hide settings" : "Show settings";
      barExportBtn.title = showing === "export" ? "Hide export options" : "Export or share";
      sheetHandle.setAttribute(
        "aria-label",
        showing === "export" ? "Close export options" : "Close settings"
      );
    }

    // A closed sheet is only translated out of sight, so without this
    // Tab walks every control in it below the bar. The tour makes the
    // whole page inert while it is up and hands the sheet back here when
    // it closes, so a breakpoint crossed under the tour still settles.
    function syncSheetInert() {
      const closedSheet = narrowLayout.matches && !document.body.classList.contains("sidebar-open");
      controls.inert = closedSheet || !document.getElementById("tutorialModal").hidden;
    }

    function setSidebarOpen(open) {
      // Closing from inside the sheet would leave focus on a control that
      // is about to go inert, or out on the strip; the button for the
      // panel that was up takes it instead.
      const panel = sheetShowing();
      const focusInside = !open && controls.contains(document.activeElement);
      document.body.classList.toggle("sidebar-open", open);
      if (!open) document.body.classList.remove("sheet-tall");
      // The held control and the sheet are never up together: the sheet
      // needs the field back in its scroll area, and the strip only has
      // a job once the sheet is out of the way.
      if (open) returnLastField();
      else showLastField();
      syncSheetButtons();
      syncSheetInert();
      if (focusInside && narrowLayout.matches) (panel === "export" ? barExportBtn : sidebarToggle).focus();
    }

    // Tapping a panel's own button while it's up closes the sheet;
    // tapping the other one swaps panels without the sheet moving.
    function showSheetPanel(mode) {
      if (sheetShowing() === mode) {
        setSidebarOpen(false);
        return;
      }
      document.body.classList.toggle("sheet-export", mode === "export");
      setSidebarOpen(true);
    }

    sidebarToggle.addEventListener("click", () => showSheetPanel("settings"));
    sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));

    // Undo, Auto-randomize and Random are the three controls pressed
    // over and over, and inside the panel every one of them costs an
    // open and a close. Below the breakpoint they move to a fixed bar at
    // the bottom of the screen, in thumb reach, with the sheet's toggle
    // beside them; above it they go back to the sidebar header. The
    // same elements move both ways rather than a second copy living in
    // the markup, so the listeners bound above and further down this
    // file follow them and no id is ever on the page twice.
    const actionBar = document.getElementById("actionBar");
    const barExportBtn = document.getElementById("barExportBtn");
    // Declared here rather than beside the drag handlers below:
    // syncSheetButtons() reads both, and syncActionBar() calls it well
    // before this script reaches that section.
    const controls = document.querySelector(".controls");
    const sheetHandle = document.getElementById("sheetHandle");
    const exploreRow = document.querySelector(".explore-row");
    const controlsHeader = document.querySelector(".controls-header");
    const appChrome = document.getElementById("appChrome");
    const footerLinkRow = document.querySelector(".footer-link-row");
    const narrowLayout = window.matchMedia("(max-width: 768px)");

    function syncActionBar() {
      // Whatever the layout is about to become, the held field belongs
      // in the panel first; the sidebar has no strip to hold it.
      returnLastField();
      if (narrowLayout.matches) {
        actionBar.prepend(exploreRow);
        actionBar.append(sidebarToggle);
        actionBar.hidden = false;
        // The export panel is the footer, so the two controls that
        // aren't about the composition move to the end of the settings
        // scroll instead of riding along with the download buttons.
        controlsBody.insertBefore(appChrome, scrollFadeBottom);
      } else {
        // Widening out of the sheet layout leaves the sidebar on
        // screen for good, so the open state goes with it.
        setSidebarOpen(false);
        document.body.classList.remove("sheet-export");
        actionBar.hidden = true;
        controlsHeader.prepend(exploreRow);
        document.body.prepend(sidebarToggle);
        footerLinkRow.prepend(appChrome);
      }
    }

    barExportBtn.addEventListener("click", () => showSheetPanel("export"));

    // Whichever setting was last reached for gets held above the bar
    // once the sheet is closed, so it can be dialled in against the
    // artwork at full size. The field itself moves, the way the
    // exploration row moves into the bar, so every listener bound to it
    // still applies and no id is duplicated; lastFieldHome is what puts
    // it back exactly where it came from, including inside a layer
    // panel built from the template.
    const lastControl = document.getElementById("lastControl");
    const lastControlSlot = document.getElementById("lastControlSlot");

    // The same delegation .controls has, repeated here because this strip
    // is not inside it. Moving an element keeps the listeners bound to
    // the element; it cannot keep the ones bound to an ancestor it no
    // longer has, and the render listener is one of those. Without this
    // a pinned field changes its own value and nothing else: no redraw,
    // which is the one thing the strip exists to give you.
    lastControl.addEventListener("input", scheduleRender);
    let lastTouchedField = null;
    let lastFieldHome = null;

    // Everything that reaches here is the user reaching for a control:
    // randomize passes and snapshot loads assign to .value directly and
    // never dispatch, and the one place this file does dispatch is the
    // color popover relaying a drag to its native input, which is a
    // real interaction and should count. Hence no isTrusted test, which
    // would have thrown that one case away.
    function rememberTouchedField(e) {
      const field = e.target.closest(".field");
      if (field && controlsBody.contains(field)) lastTouchedField = field;
    }

    controlsBody.addEventListener("input", rememberTouchedField, true);
    controlsBody.addEventListener("change", rememberTouchedField, true);

    // Puts back whatever was taken, which is not always whatever was
    // touched last: a control reached for while a field is out on the
    // strip moves lastTouchedField on without moving the field, and
    // reading it here would return the wrong element and strand the
    // right one outside the sidebar. The field travels in lastFieldHome
    // with the position it has to go back to.
    function returnLastField() {
      if (!lastFieldHome) return;
      lastFieldHome.parent.insertBefore(lastFieldHome.field, lastFieldHome.next);
      lastFieldHome = null;
      lastControl.hidden = true;
      document.body.classList.remove("has-last-control");
      // The field is back in the scroll area, so its height counts again.
      updateScrollFade();
    }

    function showLastField() {
      if (!narrowLayout.matches || !lastTouchedField || lastFieldHome) return;
      // A field can be hidden after it was touched (Speed, once the
      // last motion is gone), and pinning it put a strip on screen with
      // a close button and nothing in it.
      if (lastTouchedField.hidden) return;
      lastFieldHome = {
        field: lastTouchedField,
        parent: lastTouchedField.parentElement,
        next: lastTouchedField.nextElementSibling,
      };
      lastControlSlot.appendChild(lastTouchedField);
      lastControl.hidden = false;
      document.body.classList.add("has-last-control");
    }

    document.getElementById("lastControlClose").addEventListener("click", () => {
      returnLastField();
      lastTouchedField = null;
    });

    // The border-box height a ResizeObserver already measured, so the
    // callback reads nothing from layout. Falls back to offsetHeight
    // where borderBoxSize is missing (Safari before 15.4).
    function observedHeight(entry) {
      const box = entry.borderBoxSize && entry.borderBoxSize[0];
      return box ? box.blockSize : entry.target.offsetHeight;
    }

    // Both observers below take the height from the entry rather than
    // reading offsetHeight: they fire in one batch, the first one's
    // write to the root invalidates every style, and a read in the
    // second then forces a layout of the whole document.
    new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        "--last-control-h",
        `${observedHeight(entry)}px`
      );
    }).observe(lastControl);

    syncActionBar();
    syncSheetInert();
    narrowLayout.addEventListener("change", () => {
      syncActionBar();
      syncSheetInert();
    });

    // Drag the handle, the gesture the shape already promises. The sheet
    // opens at the height that keeps the whole canvas on screen; drag up
    // and it takes the room instead, for when the settings matter more
    // than the view. Down goes back a stop, and from the first stop it
    // dismisses. A plain tap dismisses too. Only the handle listens, so
    // the sheet's own scrolling body is left alone.
    const SHEET_DISMISS_PX = 80;
    const SHEET_EXPAND_PX = 60;
    const SHEET_TAP_PX = 4;
    let sheetDragFrom = null;

    function endSheetDrag(e) {
      if (sheetDragFrom === null) return;
      const moved = e.clientY - sheetDragFrom;
      sheetDragFrom = null;
      // Handing the transform back to the stylesheet is what springs the
      // sheet to whichever stop the class list now names.
      controls.style.transition = "";
      controls.style.transform = "";
      const wasTall = document.body.classList.contains("sheet-tall");
      if (moved < -SHEET_EXPAND_PX) {
        if (sheetShowing() === "settings") document.body.classList.add("sheet-tall");
      } else if (moved > SHEET_DISMISS_PX) {
        if (wasTall) document.body.classList.remove("sheet-tall");
        else setSidebarOpen(false);
      } else if (Math.abs(moved) < SHEET_TAP_PX) {
        setSidebarOpen(false);
      }
    }

    sheetHandle.addEventListener("pointerdown", (e) => {
      sheetDragFrom = e.clientY;
      sheetHandle.setPointerCapture(e.pointerId);
      // The sheet has to track the finger exactly while it's held.
      controls.style.transition = "none";
    });

    sheetHandle.addEventListener("pointermove", (e) => {
      if (sheetDragFrom === null) return;
      // Downward only. Following a finger upward would lift the sheet
      // off the bar and open a gap under it; that direction is read as
      // intent and snaps on release instead.
      controls.style.transform = `translateY(${Math.max(0, e.clientY - sheetDragFrom)}px)`;
    });

    sheetHandle.addEventListener("pointerup", endSheetDrag);
    sheetHandle.addEventListener("pointercancel", endSheetDrag);
    // Enter and Space. A pointer press has already been read as a tap or
    // a drag by the time its click arrives, and a click after a drag up
    // must not close the sheet the drag just raised, so only a click
    // with no pointer behind it (detail 0) is taken here.
    sheetHandle.addEventListener("click", (e) => {
      if (e.detail === 0) setSidebarOpen(false);
    });

    // Lock All, Unlock All and Undo each throw away something that took
    // a while to arrive at, and none of them can be walked back: undo
    // pops its history without recording what it replaced, so there is
    // no way forward again. On the bar all three sit under a thumb, and
    // Undo is 12px from Play. A press alone no longer runs them: the
    // button fills over HOLD_MS and fires once it is full, and a press
    // that lets go early becomes a hint instead of the action.
    // The fill in style.css has to run for exactly as long as the timer
    // below, or the bar lands early or late. Published from here so the
    // two can't drift: this is the only place the duration is written.
    const HOLD_MS = 1000;
    document.documentElement.style.setProperty("--hold-duration", `${HOLD_MS}ms`);
    let holdTimer = null;
    let holdingBtn = null;
    let holdCompleted = false;

    function endHold() {
      clearTimeout(holdTimer);
      holdTimer = null;
      if (holdingBtn) {
        holdingBtn.classList.remove("holding");
        holdingBtn.removeEventListener("pointerleave", endHold);
        holdingBtn = null;
      }
    }

    // Delegated, not bound per button: a save slot gains and loses its
    // data-hold as the slot fills and empties (see refreshPresetUI), so
    // there is no fixed set to attach to at startup.
    document.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest("[data-hold]");
      if (!btn || btn.disabled) return;
      // The main button only. A right or a middle press is asking for
      // something else (a menu, a scroll), and held for a second it ran
      // the action all the same.
      if (e.button !== 0) return;
      endHold();
      holdCompleted = false;
      holdingBtn = btn;
      btn.classList.add("holding");
      // Sliding off the button abandons the hold. Bound per press and
      // taken off again by endHold, so these don't pile up.
      btn.addEventListener("pointerleave", endHold);
      holdTimer = setTimeout(() => {
        const held = holdingBtn;
        endHold();
        holdCompleted = true;
        // Fires at the moment the fill lands rather than on release, so
        // a full bar means it is already done. Scripted clicks report
        // detail 0, which is what gets this past the gate below.
        held.click();
      }, HOLD_MS);
    });

    // Releasing anywhere ends it, including after sliding off the button.
    document.addEventListener("pointerup", endHold);
    document.addEventListener("pointercancel", endHold);

    // Capturing on the document, so this runs ahead of the handlers
    // bound to the buttons themselves whatever order they registered in.
    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest("[data-hold]");
        if (!btn) return;
        // No pointer behind it: a keyboard activation, or the scripted
        // click above. Both are deliberate, so neither needs the guard.
        if (e.detail === 0) return;
        e.preventDefault();
        e.stopPropagation();
        // The click that follows the release of a hold that already
        // fired. Swallowed, but there is nothing to tell the user.
        if (holdCompleted) {
          holdCompleted = false;
          return;
        }
        showToast(btn.dataset.hold);
      },
      true
    );

    // The settings panel and the tall stop get their heights from the
    // stylesheet, but the export panel's is whatever its buttons come
    // to. Publishing the measured height keeps .canvas-area's one rule
    // correct for all three instead of naming each of them.
    new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty("--sheet-actual", `${observedHeight(entry)}px`);
    }).observe(controls);

    // Tutorial modal: a "?" button opens a short guide, one step at a
    // time, each with a small animated demo of the actual control being
    // described. The Auto-randomize step's demo reuses generate()/
    // renderToCanvas() from the main pipeline on a fixed, unrelated
    // composition, so it's an actual cycling result rather than a canned
    // illustration; it only runs while that step is on screen.
    const tutorialBtn = document.getElementById("tutorialBtn");
    const tutorialBackdrop = document.getElementById("tutorialBackdrop");
    const tutorialModal = document.getElementById("tutorialModal");
    const tutorialDemoCanvas = document.getElementById("tutorialDemoCanvas");
    const tutorialSteps = document.querySelectorAll(".tutorial-step");
    const tutorialDotsWrap = document.getElementById("tutorialDots");
    const tutorialPrevBtn = document.getElementById("tutorialPrevBtn");
    const tutorialNextBtn = document.getElementById("tutorialNextBtn");
    // Same controls, duplicated outside the modal for the 900px+ layout
    // (see .tutorial-nav-arrow-wide in style.css for why this can't just
    // be the footer buttons repositioned). Kept in lockstep with the
    // footer pair in goToTutorialStep/advanceTutorial below.
    const tutorialPrevBtnWide = document.getElementById("tutorialPrevBtnWide");
    const tutorialNextBtnWide = document.getElementById("tutorialNextBtnWide");
    // The Auto-randomize step, whose demo is a live canvas rather than a
    // CSS animation; found by its canvas so reordering steps can't
    // silently point this at the wrong one.
    const TUTORIAL_LIVE_DEMO_STEP = [...tutorialSteps].findIndex((step) => step.contains(tutorialDemoCanvas));
    // The animated-export step, the other live canvas; found the same way.
    const tutorialAnimateCanvas = document.getElementById("tutorialAnimateCanvas");
    const tutorialAnimateKind = document.getElementById("tutorialAnimateKind");
    const TUTORIAL_ANIMATE_STEP = [...tutorialSteps].findIndex((step) => step.contains(tutorialAnimateCanvas));
    let tutorialStep = 0;
    let tutorialDemoTimer = null;
    let tutorialAnimateTimer = null;

    // "Step N of M" eyebrows are stamped here rather than trusted from
    // the markup, so a reordered or removed step can't leave stale
    // numbers behind.
    tutorialSteps.forEach((step, i) => {
      step.querySelector(".tutorial-eyebrow").textContent = `Step ${i + 1} of ${tutorialSteps.length}`;
    });

    tutorialSteps.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "tutorial-dot";
      dot.dataset.step = i;
      dot.setAttribute("aria-label", `Step ${i + 1}`);
      dot.addEventListener("click", () => goToTutorialStep(i));
      tutorialDotsWrap.appendChild(dot);
    });
    const tutorialDots = tutorialDotsWrap.querySelectorAll(".tutorial-dot");

    function stopTutorialDemo() {
      clearInterval(tutorialDemoTimer);
      tutorialDemoTimer = null;
    }

    function renderTutorialDemoFrame() {
      const options = {
        width: tutorialDemoCanvas.width,
        height: tutorialDemoCanvas.height,
        blockSize: 4,
        bgColor: "#16161a",
        layerA: {
          seed: Math.random().toString(36).slice(2),
          color: "#38bdf8",
          density: 0.3 + Math.random() * 0.3,
          fieldStrength: 0.25,
          fieldScale: 120,
          flowAngle: Math.random() * 360,
          flowStretch: 3,
          fieldOctaves: 2,
          symmetry: "quad",
          smoothPasses: 1,
        },
        layerB: {
          seed: Math.random().toString(36).slice(2),
          color: "#f472b6",
          density: 0.2 + Math.random() * 0.2,
          fieldStrength: 0.25,
          fieldScale: 80,
          flowAngle: Math.random() * 360,
          flowStretch: 2,
          fieldOctaves: 2,
          symmetry: "none",
          smoothPasses: 1,
        },
      };
      const { gridA, gridB, cols, rows } = generate(options);
      renderToCanvas(tutorialDemoCanvas, {
        ...options,
        colorA: options.layerA.color,
        colorB: options.layerB.color,
        gridA,
        gridB,
        cols,
        rows,
      });
    }

    function startTutorialDemo() {
      stopTutorialDemo();
      renderTutorialDemoFrame();
      // Respect reduced-motion: show one frame instead of cycling.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      tutorialDemoTimer = setInterval(renderTutorialDemoFrame, 1600);
    }

    // One fixed composition (seeded, so it reads as one thing moving
    // rather than a reroll) run through a full cycle of each kind in
    // turn, at the export's own frame count and rate. Enough field
    // strength for the three kinds that move the field to show, and
    // no mirror axes, since Drift and Wind read best as one-way travel.
    const TUTORIAL_ANIMATE_KINDS = ["drift", "wind", "circle", "pulse", "ripple", "tide"];
    const TUTORIAL_ANIMATE_OPTIONS = {
      width: tutorialAnimateCanvas.width,
      height: tutorialAnimateCanvas.height,
      blockSize: 2,
      bgColor: "#16161a",
      layerA: {
        seed: "tour-a",
        color: "#38bdf8",
        density: 0.42,
        fieldStrength: 0.7,
        fieldScale: 36,
        flowAngle: 20,
        flowStretch: 2.5,
        fieldOctaves: 2,
        symmetry: "none",
        smoothPasses: 1,
      },
      layerB: {
        seed: "tour-b",
        color: "#f472b6",
        density: 0.3,
        fieldStrength: 0.5,
        fieldScale: 28,
        flowAngle: 35,
        flowStretch: 2,
        fieldOctaves: 2,
        symmetry: "none",
        smoothPasses: 1,
      },
    };

    function renderTutorialAnimateFrame(kind, phase) {
      const options = Object.assign({}, TUTORIAL_ANIMATE_OPTIONS, { loopMode: kind, loopPhase: phase });
      const { gridA, gridB, cols, rows, warp } = generate(options);
      renderToCanvas(tutorialAnimateCanvas, {
        ...options,
        colorA: options.layerA.color,
        colorB: options.layerB.color,
        gridA,
        gridB,
        cols,
        rows,
        warp,
      });
    }

    function stopTutorialAnimate() {
      clearInterval(tutorialAnimateTimer);
      tutorialAnimateTimer = null;
    }

    function startTutorialAnimate() {
      stopTutorialAnimate();
      let kindIndex = 0;
      let frame = 0;
      tutorialAnimateKind.textContent = SEAMLESS_NAMES[TUTORIAL_ANIMATE_KINDS[0]];
      renderTutorialAnimateFrame(TUTORIAL_ANIMATE_KINDS[0], 0);
      // Reduced-motion: the first frame and the first name, held.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      tutorialAnimateTimer = setInterval(() => {
        frame += 1;
        if (frame === CYCLE_FRAMES) {
          frame = 0;
          kindIndex = (kindIndex + 1) % TUTORIAL_ANIMATE_KINDS.length;
          tutorialAnimateKind.textContent = SEAMLESS_NAMES[TUTORIAL_ANIMATE_KINDS[kindIndex]];
        }
        renderTutorialAnimateFrame(TUTORIAL_ANIMATE_KINDS[kindIndex], frame / CYCLE_FRAMES);
      }, CYCLE_FRAME_MS);
    }

    function goToTutorialStep(i) {
      tutorialStep = Math.max(0, Math.min(tutorialSteps.length - 1, i));
      tutorialSteps.forEach((step, idx) => step.classList.toggle("active", idx === tutorialStep));
      tutorialDots.forEach((dot, idx) => dot.classList.toggle("active", idx === tutorialStep));
      const atFirstStep = tutorialStep === 0;
      tutorialPrevBtn.disabled = atFirstStep;
      tutorialPrevBtnWide.disabled = atFirstStep;
      // The last step has nowhere to go "next", so the button becomes a
      // Replay instead of disabling: it stays useful rather than going dead.
      const onLastStep = tutorialStep === tutorialSteps.length - 1;
      const nextIcon = onLastStep ? "arrow-counter-clockwise" : "caret-down";
      const nextTitle = onLastStep ? "Replay" : "Next";
      [tutorialNextBtn, tutorialNextBtnWide].forEach((btn) => {
        btn.classList.toggle("replay", onLastStep);
        btn.title = nextTitle;
        setIcon(btn.querySelector("i"), nextIcon);
      });
      if (tutorialStep === TUTORIAL_LIVE_DEMO_STEP) startTutorialDemo();
      else stopTutorialDemo();
      if (tutorialStep === TUTORIAL_ANIMATE_STEP) startTutorialAnimate();
      else stopTutorialAnimate();
    }

    function advanceTutorial() {
      if (tutorialStep === tutorialSteps.length - 1) goToTutorialStep(0);
      else goToTutorialStep(tutorialStep + 1);
    }

    tutorialPrevBtn.addEventListener("click", () => goToTutorialStep(tutorialStep - 1));
    tutorialNextBtn.addEventListener("click", advanceTutorial);
    tutorialPrevBtnWide.addEventListener("click", () => goToTutorialStep(tutorialStep - 1));
    tutorialNextBtnWide.addEventListener("click", advanceTutorial);

    // Only gates the first-visit chip; the "?" button always opens the
    // tour regardless of this flag. Same key the old "don't show this
    // automatically" checkbox wrote, so anyone who ticked it never sees
    // the chip either. Set once the tour has been opened by any route,
    // or the chip dismissed.
    const TUTORIAL_DISMISSED_KEY = "flield-tutorial-dismissed";
    const tourChip = document.getElementById("tourChip");
    let tutorialDismissed = false;
    try {
      tutorialDismissed = localStorage.getItem(TUTORIAL_DISMISSED_KEY) === "1";
    } catch (err) {
      // localStorage can be unavailable (private browsing, blocked); the
      // chip just comes back next visit.
    }

    function dismissTourChip() {
      tourChip.hidden = true;
      tutorialDismissed = true;
      try {
        localStorage.setItem(TUTORIAL_DISMISSED_KEY, "1");
      } catch (err) {
        // Same as above.
      }
    }

    // The tour is modal in fact, not just in its aria-modal: while it is
    // open the rest of the page is inert, so Tab walks the tour alone and
    // an arrow key cannot reach a slider behind it. The wide arrows sit
    // outside the modal (see above), which is why this marks the page's
    // other top-level elements rather than calling <dialog>.showModal(),
    // which would make those two inert as well. Only what this made
    // inert is released, so anything already inert stays that way.
    const TUTORIAL_LAYER = new Set([tutorialBackdrop, tutorialModal, tutorialPrevBtnWide, tutorialNextBtnWide]);
    let tutorialInerted = [];
    let tutorialReturnFocus = null;

    function openTutorial() {
      if (!tutorialModal.hidden) return;
      tutorialReturnFocus = document.activeElement;
      dismissTourChip();
      tutorialBackdrop.hidden = false;
      tutorialModal.hidden = false;
      tutorialPrevBtnWide.hidden = false;
      tutorialNextBtnWide.hidden = false;
      tutorialInerted = [...document.body.children].filter((el) => !TUTORIAL_LAYER.has(el) && el.tagName !== "SCRIPT" && !el.inert);
      tutorialInerted.forEach((el) => { el.inert = true; });
      goToTutorialStep(0);
      tutorialModal.focus();
    }

    function closeTutorial() {
      tutorialBackdrop.hidden = true;
      tutorialModal.hidden = true;
      tutorialPrevBtnWide.hidden = true;
      tutorialNextBtnWide.hidden = true;
      tutorialInerted.forEach((el) => { el.inert = false; });
      tutorialInerted = [];
      syncSheetInert();
      stopTutorialDemo();
      stopTutorialAnimate();
      // Back to whatever opened it. The tour chip hides itself on the way
      // in, so its button can't take focus back; the ? button stands in.
      const back = tutorialReturnFocus && tutorialReturnFocus.isConnected && tutorialReturnFocus.checkVisibility() ? tutorialReturnFocus : tutorialBtn;
      tutorialReturnFocus = null;
      back.focus();
    }

    tutorialBtn.addEventListener("click", openTutorial);
    document.getElementById("tourChipOpenBtn").addEventListener("click", openTutorial);
    document.getElementById("tourChipDismissBtn").addEventListener("click", dismissTourChip);
    document.getElementById("tutorialCloseBtn").addEventListener("click", closeTutorial);
    tutorialBackdrop.addEventListener("click", closeTutorial);
    // Tab wraps at either end of the tour rather than leaving it for the
    // document, which inert alone would allow.
    function tutorialFocusables() {
      return [...tutorialModal.querySelectorAll("button, [tabindex]:not([tabindex='-1'])"), tutorialPrevBtnWide, tutorialNextBtnWide]
        .filter((el) => !el.disabled && el.checkVisibility());
    }

    document.addEventListener("keydown", (e) => {
      if (tutorialModal.hidden) return;
      if (e.key === "Tab") {
        // Only the two ends are handled; in between the browser's own
        // order stands, which also reaches the scrollable step body.
        const stops = tutorialFocusables();
        const active = document.activeElement;
        const first = stops[0];
        const last = stops[stops.length - 1];
        if (e.shiftKey && (active === first || active === tutorialModal)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (e.key === "ArrowRight") advanceTutorial();
      else if (e.key === "ArrowLeft" && !tutorialPrevBtn.disabled) goToTutorialStep(tutorialStep - 1);
    });

    // One Escape closes one layer, the topmost: the tour over everything,
    // then the color picker, then the phone sheet. Each used to listen
    // for itself, so a single press closed the picker and the sheet
    // under it together, and the tour and the sheet the same way.
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!tutorialModal.hidden) closeTutorial();
      else if (!colorPopover.hidden) closeColorPicker();
      else if (document.body.classList.contains("sidebar-open")) setSidebarOpen(false);
    });

    // Shortcuts for the exploration loop, the three things pressed over
    // and over while hunting for a composition: R rerolls, Space toggles
    // Auto-randomize, Cmd/Ctrl+Z steps back. All three stay out of the
    // way of typing: a focused text/number field or select keeps its
    // own keys (R types a letter there, Cmd+Z is the field's own undo,
    // Space opens the select), and a focused button keeps Space as its
    // native click. Range sliders don't use any of these, so they still
    // work with a slider focused after a drag. Held-down repeat is
    // ignored so a long press on R can't fire a burst of rerolls.
    document.addEventListener("keydown", (e) => {
      if (!tutorialModal.hidden || !colorPopover.hidden || e.altKey || e.repeat) return;
      const target = e.target instanceof Element ? e.target : document.body;
      const inField = target.matches('input:not([type="range"]), textarea, select');
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (inField) return;
        e.preventDefault();
        if (!undoBtn.disabled) undoBtn.click();
        return;
      }
      if (mod) return;
      if (e.key.toLowerCase() === "r") {
        if (inField) return;
        e.preventDefault();
        performRandomize();
      } else if (e.key === " ") {
        // A button focused by keyboard keeps Space as its native click.
        // One that merely kept focus from a mouse click (most commonly
        // Random itself) must not, or Space would re-fire that button
        // instead of toggling playback.
        if (inField || (target.matches("button") && target.matches(":focus-visible"))) return;
        e.preventDefault();
        playBtn.click();
      }
    });

    // The link codec is in core.js; what it needs from the page is read
    // here, off the live controls, each time a link is written or read.
    // See the note above encodeCompact in core.js.
    const optionValues = (id) => [...document.getElementById(id).options].map((o) => o.value);
    function linkPage() {
      return {
        options: {
          shapeMask: optionValues("shapeMask"),
          motion: optionValues("motion"),
          symmetry: optionValues("layerA-symmetry"),
          texture: optionValues("layerA-texture"),
          layerMotion: optionValues("layerA-motion"),
        },
        depth: { min: parseInt(depthInput.min, 10), max: parseInt(depthInput.max, 10), defaultIndex: DEPTH_DEFAULT_INDEX },
        defaultSpeedStep: parseInt(speedInput.defaultValue, 10),
      };
    }

    function encodeCompact(snapshot) {
      return FlieldCore.encodeCompact(snapshot, linkPage());
    }

    function decodeCompact(encoded) {
      return FlieldCore.decodeCompact(encoded, linkPage());
    }

    function loadStateFromURL() {
      const params = new URLSearchParams(location.search);
      const compact = params.get("c");
      // The base64'd JSON the compact format replaced. Links shared
      // before it, and the source line inside every SVG exported before
      // it, still arrive as ?state=, so they still open.
      const legacy = params.get("state");
      if (!compact && !legacy) return false;
      try {
        const data = upgradeState(compact ? decodeCompact(compact) : JSON.parse(atob(legacy)));
        applySnapshot(data);
        // A link copied with "Offers to play" chosen sets the recorded
        // speed and shows the prompt. Nothing moves until the recipient
        // says so, which has to include the motion: applySnapshot has
        // already started it by this point, and a canvas animating
        // behind a button offering to start it reads as a broken button.
        if (data.autoplay) {
          stopSeamlessPreview();
          const speedText = formatSpeed(currentIntervalMs());
          document.getElementById("playOfferSpeed").textContent = speedText;
          document.getElementById("playOfferText").title =
            `Locked fields hold, the rest reroll every ${speedText}`;
          playOffer.hidden = false;
        }
        addressCarriesLink = true;
        return true;
      } catch (err) {
        // A link that cannot be read used to fall through to a random
        // composition without a word, which reads as the link having
        // worked and being someone's odd taste.
        showToast("Couldn't open that link");
        return false;
      }
    }

    function stateUrl(snapshot) {
      return `${location.origin}${location.pathname}?c=${encodeCompact(snapshot)}`;
    }

    // Encodes the current composition (and, per the menu, an autoplay
    // flag) into the URL the button below hands off, whether that's a
    // clipboard copy or the OS share sheet.
    function buildShareLink() {
      const snapshot = snapshotForSharing();
      // The menu beside the button decides: a link that offers to play
      // (at the current Auto-randomize speed) is a live instance to drop
      // into a post, once the recipient accepts; a still is the default.
      if (linkModeSelect.value === "play") snapshot.autoplay = currentIntervalMs();
      return { url: stateUrl(snapshot), autoplay: snapshot.autoplay };
    }

    const copyLinkBtn = document.getElementById("copyLinkBtn");

    // On a touch device the OS share sheet is the better hand-off
    // (Messages, AirDrop, whatever else is installed), so the button
    // gives it the link instead of the clipboard, and the label and icon
    // change to match rather than hiding the swap under Copy Link.
    //
    // Gated on the pointer, not on the API: desktop Chromium (Brave and
    // Chrome on macOS) exposes navigator.share too, and the sheet it
    // opens there offers Mail, Messages, Notes and Reminders but no
    // clipboard, which is the one thing someone pressing a button
    // labelled Copy Link was after.
    const canShare = !!navigator.share && window.matchMedia("(pointer: coarse)").matches;
    if (canShare) {
      copyLinkBtn.innerHTML = iconTag("share-network") + " Share";
      copyLinkBtn.title = "Share this exact composition, locks included";
    }

    async function copyShareLink(url, autoplay) {
      try {
        await navigator.clipboard.writeText(url);
        showToast(autoplay ? "Link copied, plays on open" : "Link copied");
      } catch (err) {
        try {
          window.prompt("Copy this link:", url);
        } catch (err2) {
          // Dialogs are unavailable in some environments; nothing more to do.
        }
      }
    }

    copyLinkBtn.addEventListener("click", async () => {
      const { url, autoplay } = buildShareLink();
      if (canShare) {
        try {
          await navigator.share({ title: "Flield", text: "A composition I made with Flield:", url });
          return;
        } catch (err) {
          // A cancelled sheet is normal and wants nothing after it. Any
          // other failure (a browser that refuses the call, a sheet that
          // never opens) would leave the button doing nothing at all, so
          // the clipboard below still gets the link.
          if (err && err.name === "AbortError") return;
        }
      }
      copyShareLink(url, autoplay);
    });

    if (!loadStateFromURL()) {
      // bgColor is locked by default (see the #tab-general lock-init
      // above), so performRandomize() below won't touch it; without
      // this, every fresh visit would keep the same hardcoded value
      // from its HTML attribute instead of getting its own starting
      // background like a shared link or saved state would carry.
      document.getElementById("bgColor").value = randomBgColor();
      // A 1200x630 canvas on a portrait phone is bound by width, not
      // height: it lands about 180px tall inside an artboard 615px
      // deep, so most of the screen is empty and a 1200px composition
      // shown 343px wide has its block grid scaled past the point of
      // being visible at all. Portrait screens open on the Mobile
      // preset instead, which fills that depth and shows the grid
      // nearer its own scale. Opening size only: a shared link carries
      // its own dimensions through loadStateFromURL above, size is not
      // in RANDOMIZABLE_FIELDS, and the preset chip lights itself off
      // the values (see updatePresetChips), so nothing else needs to
      // know this happened. Read as a media query rather than from
      // innerHeight and innerWidth: those force a layout of the whole
      // document at this point, after everything above has changed
      // it, and the browser lays it all out again for the first paint.
      if (narrowLayout.matches && window.matchMedia("(orientation: portrait)").matches) {
        document.getElementById("width").value = DIMENSION_PRESETS.mobile.width;
        document.getElementById("height").value = DIMENSION_PRESETS.mobile.height;
      }
      performRandomize(false);
    }
    generateRandomFavicon();
    // After the first paint rather than now: the fades read the tab
    // body's scroll geometry, and reading it here forces a layout of the
    // document that the first frame then repeats. Two frames on, that
    // layout has happened and the read is free.
    requestAnimationFrame(() => requestAnimationFrame(updateScrollFade));
    // A beat after first paint, so the composition lands before the
    // nudge does.
    // Re-checked inside the timer: opening the tour from "?" within that
    // beat would otherwise surface the chip after the fact.
    // Yields to a play offer on the same load; the "?" button still
    // opens the tour, and the chip returns on the next plain visit.
    if (!tutorialDismissed) setTimeout(() => { if (!tutorialDismissed && playOffer.hidden) tourChip.hidden = false; }, 700);

// The color picker every swatch opens, carved out of app.js. index.html
// loads it after app.js, because it reads the app's helpers (render,
// markTabs, the color math from core.js) as it starts; app.js reaches
// back into it only from handlers that run later. Shares the page's one
// script scope with app.js: a name declared twice across the files is the
// same SyntaxError it was in one.

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
    // Escape is handled once, for every layer (the keydown handler after
    // the tour's in app.js), so it closes only the one on top.

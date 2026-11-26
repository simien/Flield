// The tour the "?" button opens, carved out of app.js. index.html loads
// it after app.js and picker.js, because it starts by drawing with the
// app's pipeline (generate, readOptions, SEAMLESS_NAMES) and ends by
// timing the first-visit chip against the app's play offer. Shares the
// page's one script scope with app.js.

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

    // A beat after first paint, so the composition lands before the
    // nudge does.
    // Re-checked inside the timer: opening the tour from "?" within that
    // beat would otherwise surface the chip after the fact.
    // Yields to a play offer on the same load; the "?" button still
    // opens the tour, and the chip returns on the next plain visit.
    if (!tutorialDismissed) setTimeout(() => { if (!tutorialDismissed && playOffer.hidden) tourChip.hidden = false; }, 700);

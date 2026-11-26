// Hold-to-confirm for every button that carries data-hold, carved out of
// app.js. It needs nothing from the app while it loads, so index.html
// loads it ahead of app.js; showToast is app.js's, called only once a
// press lands. Shares the page's one script scope with app.js.

    // The two bulk lock buttons and Undo each throw away something that
    // took a while to arrive at, and none of them can be walked back: undo
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

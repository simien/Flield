// The theme toggle on the document pages: the guide and the three
// explainers. Each page carried its own copy of this until November 2026.
// The head script on every page sets data-theme before the first paint, so
// this only draws the button and handles a press. A page that paints in the
// theme's colors listens for "themechange" on the document and repaints; the
// first paint is the page's own, since this runs before its script does.
// Wrapped in a function because the pages' scripts share one global scope.
(() => {
  // Phosphor's own path data, the same two glyphs and the same flield-theme
  // key the app's toggle uses, so a choice made on any page carries to the
  // others and looks identical there.
  const ICONS = {
    sun: "M116,36V20a12,12,0,0,1,24,0V36a12,12,0,0,1-24,0Zm80,92a68,68,0,1,1-68-68A68.07,68.07,0,0,1,196,128Zm-24,0a44,44,0,1,0-44,44A44.05,44.05,0,0,0,172,128ZM51.51,68.49a12,12,0,1,0,17-17l-12-12a12,12,0,0,0-17,17Zm0,119-12,12a12,12,0,0,0,17,17l12-12a12,12,0,1,0-17-17ZM196,72a12,12,0,0,0,8.49-3.51l12-12a12,12,0,0,0-17-17l-12,12A12,12,0,0,0,196,72Zm8.49,115.51a12,12,0,0,0-17,17l12,12a12,12,0,0,0,17-17ZM48,128a12,12,0,0,0-12-12H20a12,12,0,0,0,0,24H36A12,12,0,0,0,48,128Zm80,80a12,12,0,0,0-12,12v16a12,12,0,0,0,24,0V220A12,12,0,0,0,128,208Zm108-92H220a12,12,0,0,0,0,24h16a12,12,0,0,0,0-24Z",
    moon: "M236.37,139.4a12,12,0,0,0-12-3A84.07,84.07,0,0,1,119.6,31.59a12,12,0,0,0-15-15A108.86,108.86,0,0,0,49.69,55.07,108,108,0,0,0,136,228a107.09,107.09,0,0,0,64.93-21.69,108.86,108.86,0,0,0,38.44-54.94A12,12,0,0,0,236.37,139.4Zm-49.88,47.74A84,84,0,0,1,68.86,69.51,84.93,84.93,0,0,1,92.27,48.29Q92,52.13,92,56A108.12,108.12,0,0,0,200,164q3.87,0,7.71-.27A84.79,84.79,0,0,1,186.49,187.14Z",
  };

  function iconSvg(name) {
    return `<svg viewBox="0 0 256 256" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
  }

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
    themeToggleBtn.innerHTML = iconSvg(isLight ? "moon" : "sun");
    themeToggleBtn.title = isLight ? "Switch to dark theme" : "Switch to light theme";
    document.dispatchEvent(new CustomEvent("themechange", { detail: { light: isLight } }));
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
})();

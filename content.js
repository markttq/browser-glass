(() => {
  // v0.7.0: resolve the bundled wallpaper to an absolute extension URL.
  // This avoids page-relative URL resolution and works regardless of ChatGPT route.
  const wallpaperUrl = chrome.runtime.getURL("tahoe-day.jpg");
  document.documentElement.style.setProperty("--cgh-wallpaper-image", `url("${wallpaperUrl}")`);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Shortcut-owned levels only: Instant (0) -> Medium (1) -> High (2).
  // Higher levels remain manual-only.
  const SHORTCUT_LEVEL_COUNT = 3;
  const RESET_DELAY_MS = 250;
  const RESET_RETRY_DELAY_MS = 700;

  let busy = false;
  let pickerTrigger = null;
  let lastChatKey = getChatKey();
  let navigationCheckQueued = false;
  let resetTimer = 0;
  let resetRetryTimer = 0;

  const STEALTH_ATTR = "data-chatgpt-thinking-helper-stealth";

  // v0.6.8: no separate wallpaper DOM node. The wallpaper is hosted
  // directly on ChatGPT's top-level app frame by glass.css.


  // v0.6.6: wallpaper rendering is intentionally single-layer only.
  // All legacy surface scanning, direct wallpaper painting, and overlay fallbacks
  // were removed because their inline !important backgrounds caused seams.


  function captureFocusState() {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!active) return null;

    const state = { active, selectionStart: null, selectionEnd: null, range: null };

    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      state.selectionStart = active.selectionStart;
      state.selectionEnd = active.selectionEnd;
      return state;
    }

    if (active.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (active.contains(range.commonAncestorContainer)) state.range = range.cloneRange();
      }
    }

    return state;
  }

  function restoreFocusState(state) {
    if (!state?.active?.isConnected) return;

    try { state.active.focus({ preventScroll: true }); }
    catch { state.active.focus(); }

    if (state.active instanceof HTMLInputElement || state.active instanceof HTMLTextAreaElement) {
      if (state.selectionStart != null && state.selectionEnd != null) {
        try { state.active.setSelectionRange(state.selectionStart, state.selectionEnd); } catch {}
      }
      return;
    }

    if (state.active.isContentEditable && state.range) {
      const sel = window.getSelection();
      if (!sel) return;
      try {
        sel.removeAllRanges();
        sel.addRange(state.range);
      } catch {}
    }
  }

  function beginStealth() {
    document.documentElement.setAttribute(STEALTH_ATTR, "true");
  }

  function endStealth() {
    document.documentElement.removeAttribute(STEALTH_ATTR);
  }

  function getChatKey() {
    const match = location.pathname.match(/^\/c\/([^/]+)/);
    if (match) return `chat:${match[1]}`;
    if (location.pathname === "/" || location.pathname === "") return "new-chat";
    return location.pathname;
  }

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest('[inert], [aria-hidden="true"]')) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function textOf(el) {
    return [
      el?.getAttribute?.("aria-label"),
      el?.getAttribute?.("data-testid"),
      el?.getAttribute?.("title"),
      el?.innerText,
      el?.textContent,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function findPickerTrigger() {
    if (pickerTrigger?.isConnected && isVisible(pickerTrigger)) return pickerTrigger;
    pickerTrigger = null;

    const candidates = [...document.querySelectorAll('button,[role="button"]')].filter(isVisible);
    const effortWords = /\b(instant|low|medium|high|extra high|thinking|reasoning|effort)\b/i;

    const direct = candidates.find((el) => effortWords.test(textOf(el)));
    if (direct) return direct;

    pickerTrigger = candidates.find((el) => {
      const text = textOf(el);
      return el.getAttribute("aria-haspopup") === "menu" && /gpt|model/.test(text);
    }) || null;
    return pickerTrigger;
  }

  function getOpenReasoningControl() {
    return [...document.querySelectorAll('[data-reasoning-slider="true"]')]
      .filter((el) => !el.closest('[inert], [aria-hidden="true"]'))
      .at(-1) || null;
  }

  function getSliderState(control) {
    const slider = control?.querySelector('[role="slider"][aria-valuenow]');
    if (!slider) return null;

    return {
      slider,
      min: Number(slider.getAttribute("aria-valuemin") ?? 0),
      max: Number(slider.getAttribute("aria-valuemax") ?? 0),
      value: Number(slider.getAttribute("aria-valuenow") ?? 0),
    };
  }

  function getExactTriggerFromControl(control) {
    const menu = control?.closest('[role="menu"][data-state="open"]');
    const labelledBy = menu?.getAttribute("aria-labelledby");
    return labelledBy ? document.getElementById(labelledBy) : null;
  }

  function pickerIsOpen(control = null) {
    if (control?.isConnected) {
      const menu = control.closest('[role="menu"]');
      if (menu?.getAttribute("data-state") === "open") return true;
    }
    return Boolean(getOpenReasoningControl());
  }

  async function openReasoningPicker() {
    let control = getOpenReasoningControl();
    if (control) {
      const trigger = getExactTriggerFromControl(control);
      if (trigger) pickerTrigger = trigger;
      return { control, trigger };
    }

    const trigger = findPickerTrigger();
    if (!trigger) return null;

    trigger.click();

    // Fast path: ChatGPT normally mounts the Radix menu synchronously.
    control = getOpenReasoningControl();
    if (control) {
      const exactTrigger = getExactTriggerFromControl(control) || trigger;
      pickerTrigger = exactTrigger;
      return { control, trigger: exactTrigger };
    }

    // Fallback: observe DOM insertion instead of 25 ms polling.
    control = await new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const found = getOpenReasoningControl();
        if (!found) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(found);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(getOpenReasoningControl());
      }, 180);
    });

    if (!control) {
      pickerTrigger = null;
      return null;
    }

    const exactTrigger = getExactTriggerFromControl(control) || trigger;
    pickerTrigger = exactTrigger;
    return { control, trigger: exactTrigger };
  }

  function dispatchArrow(target, key) {
    const init = { key, code: key, bubbles: true, cancelable: true, composed: true };
    target.dispatchEvent(new KeyboardEvent("keydown", init));
    target.dispatchEvent(new KeyboardEvent("keyup", init));
  }

  async function keyboardSetValue(control, wanted) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const state = getSliderState(control);
      if (!state) return false;
      if (state.value === wanted) return true;

      const key = wanted > state.value ? "ArrowRight" : "ArrowLeft";
      const before = state.value;

      try { control.focus({ preventScroll: true }); } catch { control.focus(); }
      dispatchArrow(control, key);
      await Promise.resolve();
      if (getSliderState(control)?.value !== before) continue;

      // Tiny fallback delay for React builds that commit on the next task.
      await sleep(6);
      if (getSliderState(control)?.value !== before) continue;

      dispatchArrow(state.slider, key);
      await Promise.resolve();
      if (getSliderState(control)?.value === before) {
        await sleep(6);
        if (getSliderState(control)?.value === before) return false;
      }
    }

    return getSliderState(control)?.value === wanted;
  }

  async function pointerSetValue(control, wanted) {
    const state = getSliderState(control);
    if (!state) return false;

    const root = [...control.querySelectorAll('[data-orientation="horizontal"]')]
      .find((el) => el !== state.slider && el.contains(state.slider));
    if (!root) return false;

    const ticks = [...root.querySelectorAll('[data-selected]')];
    let x;
    let y;

    if (ticks.length === state.max - state.min + 1) {
      const tick = ticks[wanted - state.min];
      const rect = tick.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } else {
      const rect = root.getBoundingClientRect();
      const ratio = (wanted - state.min) / Math.max(1, state.max - state.min);
      x = rect.left + 13 + ratio * Math.max(1, rect.width - 26);
      y = rect.top + rect.height / 2;
    }

    const target = document.elementFromPoint(x, y) || root;
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
    };

    target.dispatchEvent(new PointerEvent("pointerdown", { ...base, buttons: 1 }));
    target.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
    target.dispatchEvent(new PointerEvent("pointerup", { ...base, buttons: 0 }));
    target.dispatchEvent(new MouseEvent("mouseup", { ...base, buttons: 0 }));
    target.dispatchEvent(new MouseEvent("click", { ...base, buttons: 0 }));

    await Promise.resolve();
    if (getSliderState(control)?.value === wanted) return true;
    await sleep(8);
    return getSliderState(control)?.value === wanted;
  }

  async function setReasoningValue(control, wanted) {
    const state = getSliderState(control);
    if (!state) return false;

    const clamped = Math.max(state.min, Math.min(state.max, wanted));
    if (state.value === clamped) return true;
    if (await keyboardSetValue(control, clamped)) return true;
    return pointerSetValue(control, clamped);
  }

  function dispatchEscape(target) {
    const init = { key: "Escape", code: "Escape", bubbles: true, cancelable: true, composed: true };
    target?.dispatchEvent?.(new KeyboardEvent("keydown", init));
    target?.dispatchEvent?.(new KeyboardEvent("keyup", init));
  }

  async function closePicker(control, trigger) {
    let exactTrigger = getExactTriggerFromControl(control) || trigger;

    if (exactTrigger?.getAttribute("aria-expanded") === "true") {
      exactTrigger.click();
    }

    // Fast path: Radix normally flips state synchronously. One frame is enough
    // to prevent a closing-animation flash before stealth mode is removed.
    if (!pickerIsOpen(control) || exactTrigger?.getAttribute("aria-expanded") === "false") {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return true;
    }

    // Fallback only for builds where trigger-click does not close immediately.
    dispatchEscape(control);
    dispatchEscape(document.activeElement);

    for (let i = 0; i < 6; i++) {
      if (!pickerIsOpen(control)) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        return true;
      }
      await sleep(10);
    }

    exactTrigger = getExactTriggerFromControl(control) || exactTrigger;
    if (exactTrigger?.getAttribute("aria-expanded") === "true") exactTrigger.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return !pickerIsOpen(control);
  }

  async function withStealthPicker(action) {
    if (busy) return false;
    busy = true;

    // Opening Radix's model picker moves focus away from the composer. Save
    // both the focused element and its caret/selection so Shift+Tab behaves
    // like a real editor shortcut instead of blurring the prompt.
    const focusState = captureFocusState();
    beginStealth();

    let opened = null;
    try {
      opened = await openReasoningPicker();
      if (!opened) return false;
      return await action(opened.control);
    } catch {
      return false;
    } finally {
      if (opened) {
        try {
          await closePicker(opened.control, opened.trigger);
        } catch {}
      }
      endStealth();
      restoreFocusState(focusState);
      busy = false;
    }
  }

  async function cycleReasoning() {
    return withStealthPicker(async (control) => {
      const state = getSliderState(control);
      if (!state) return false;

      // ChatGPT currently exposes five slider positions, but the shortcut only
      // owns the first three: Instant, Medium, High. If the user manually
      // selected XHigh/Pro, Shift+Tab returns to Instant instead of cycling
      // through those manual-only levels.
      const shortcutMax = Math.min(state.max, state.min + SHORTCUT_LEVEL_COUNT - 1);
      const next =
        state.value < state.min || state.value >= shortcutMax
          ? state.min
          : state.value + 1;

      return setReasoningValue(control, next);
    });
  }

  async function resetToInstant() {
    return withStealthPicker(async (control) => {
      const state = getSliderState(control);
      if (!state) return false;
      return setReasoningValue(control, state.min);
    });
  }

  function scheduleReset() {
    if (resetTimer) clearTimeout(resetTimer);
    if (resetRetryTimer) clearTimeout(resetRetryTimer);

    resetTimer = setTimeout(async () => {
      resetTimer = 0;
      if (await resetToInstant()) return;
      resetRetryTimer = setTimeout(() => {
        resetRetryTimer = 0;
        resetToInstant();
      }, RESET_RETRY_DELAY_MS);
    }, RESET_DELAY_MS);
  }

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Tab" && event.shiftKey &&
      !event.ctrlKey && !event.altKey && !event.metaKey
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      cycleReasoning();
    }
  }, true);

  document.addEventListener("click", (event) => {
    const el = event.target instanceof Element
      ? event.target.closest('button,a,[role="button"]')
      : null;
    if (!el) return;

    const aria = (el.getAttribute("aria-label") || "").trim().toLowerCase();
    const text = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (aria === "new chat" || text === "new chat") scheduleReset();

    if (el instanceof HTMLAnchorElement) {
      try {
        const url = new URL(el.href, location.href);
        if (url.origin === location.origin) setTimeout(checkNavigation, 0);
      } catch {}
    }
  }, true);

  function queueNavigationCheck() {
    if (navigationCheckQueued) return;
    navigationCheckQueued = true;

    queueMicrotask(() => {
      navigationCheckQueued = false;
      checkNavigation();
    });
  }

  function patchHistoryMethod(method) {
    const original = history[method];
    if (typeof original !== "function") return;

    history[method] = function (...args) {
      const result = original.apply(this, args);
      queueNavigationCheck();
      return result;
    };
  }

  function checkNavigation() {
    if (location.pathname === observedPathname) return;
    observedPathname = location.pathname;

    const key = getChatKey();
    if (key === lastChatKey) return;

    const previous = lastChatKey;
    lastChatKey = key;
    if (previous === "new-chat" && key.startsWith("chat:")) return;
    scheduleReset();
  }

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  addEventListener("popstate", checkNavigation);
  addEventListener("hashchange", checkNavigation);
  addEventListener("pageshow", checkNavigation);

  if (window.navigation?.addEventListener) {
    window.navigation.addEventListener("currententrychange", queueNavigationCheck);
  }

  // Fallback for SPA route changes that do not emit observable navigation
  // events in the extension's isolated world. Unlike a subtree observer this
  // runs at a fixed low frequency instead of on every streamed DOM update.
  let observedPathname = location.pathname;
  setInterval(checkNavigation, 500);
})();

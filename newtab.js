"use strict";

// Markentum daily reading, using Browser Glass’s shared Tahoe background.
const FLAVOURS = ["rosepine-moon", "frappe", "macchiato", "mocha"];

const $ = (id) => document.getElementById(id);

/* ---- storage ---------------------------------------------------------- */

const get = (keys) =>
  new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const set = (items) =>
  new Promise((resolve) => chrome.storage.local.set(items, resolve));

/* ---- flavour ---------------------------------------------------------- */

function applyFlavour(name) {
  document.documentElement.dataset.flavour = name;
  $("flavour").textContent = name;
}

async function initFlavour() {
  const { flavour } = await get("flavour");
  applyFlavour(FLAVOURS.includes(flavour) ? flavour : FLAVOURS[0]);

  $("flavour").addEventListener("click", async () => {
    const next =
      FLAVOURS[
        (FLAVOURS.indexOf(document.documentElement.dataset.flavour) + 1) %
          FLAVOURS.length
      ];
    applyFlavour(next);
    await set({ flavour: next });
  });
}

/* ---- lesson ----------------------------------------------------------- */

function render(lesson) {
  $("claim").textContent = lesson.title;
  $("body").textContent = lesson.body;
  $("book").textContent = lesson.book;
  $("author").textContent = lesson.author || "";
  $("lesson").hidden = false;
  $("empty-state").hidden = true;
  $("rotate").disabled = false;
}

/**
 * FNV-1a over the date, so the day alone decides the lesson.
 *
 * Deliberately not `Math.random()` stored in the cache: a stored pick has to
 * be written before the first tab of the day can render, which puts a storage
 * round-trip on the critical path and loses the lesson entirely if the write
 * races a browser quit. A hash needs no state - every tab, and every window,
 * computes the same index from the same date with nothing shared.
 */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Local date as YYYY-MM-DD. Local, so the lesson turns over at midnight. */
function today() {
  return new Date().toLocaleDateString("en-CA");
}

async function initLesson() {
  let lessons;
  try {
    const res = await fetch(chrome.runtime.getURL("lessons.json"));
    if (!res.ok) return;
    lessons = await res.json();
    if (Array.isArray(lessons)) lessons = lessons.filter(lesson =>
      lesson && ["title", "body", "book"].every(key => typeof lesson[key] === "string")
      && (!lesson.author || typeof lesson.author === "string"));
  } catch {
    return; // The wallpaper and setup hint remain available.
  }
  if (!Array.isArray(lessons) || lessons.length === 0) return;

  const day = today();
  const base = hash(day) % lessons.length;

  // The rotation is an offset from the day's lesson rather than an absolute
  // index, and it is scoped to the day it was made: skip past one you have
  // already taken in and tomorrow still arrives on its own. Stored, so the
  // skip holds across tabs instead of snapping back on the next one.
  const stored = (await get("rotation")).rotation;
  let offset = stored && stored.day === day && Number.isSafeInteger(stored.offset) && stored.offset >= 0 ? stored.offset % lessons.length : 0;

  const draw = () => render(lessons[(base + offset) % lessons.length]);
  draw();

  const rotate = () => {
    offset = (offset + 1) % lessons.length;
    draw();
    set({ rotation: { day, offset } });
  };

  $("rotate").addEventListener("click", rotate);
  // `n` for the same thing, since the corner control is small on purpose and
  // hands are usually on the keyboard when a new tab opens.
  document.addEventListener("keydown", (e) => {
    if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) rotate();
  });
}

// Theme and lessons load independently; neither delays the wallpaper.
initFlavour();
initLesson();

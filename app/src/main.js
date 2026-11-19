// Vice Cover Studio: wires the page. Up to four photos live in slots; each panel of the chosen
// layout shows one slot's photo with its own focal point and zoom. The preview canvas is the
// export itself at full size, so what you see is the PNG you get. A ?shot= query builds a fixed
// scene for a screenshot instead (./shots.js).
import { drawCoverArt, panelLayout, panelAt } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const captionInput = document.getElementById('caption');
const subcaptionInput = document.getElementById('subcaption');
const gradeInput = document.getElementById('grade');
const captionScaleInput = document.getElementById('captionScale');
const panelZoomInput = document.getElementById('panelZoom');
const panelPhotoLabel = document.getElementById('panelPhotoLabel');

const SAMPLES = ['rider', 'queen', 'boulevard', 'pier'];
const state = {
  template: 'hero',
  size: [1080, 1350],
  slots: [null, null, null, null],
  slotNames: ['', '', '', ''],
  panelPhoto: [0, 1, 2, 3],
  transforms: [0, 1, 2, 3].map(() => ({ focalX: 0.5, focalY: 0.5, zoom: 1 })),
  selectedPanel: 0,
};

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function currentArt() {
  const count = panelLayout(state.template, state.size[0], state.size[1]).length;
  return {
    template: state.template,
    caption: captionInput.value,
    subcaption: subcaptionInput.value,
    grade: Number(gradeInput.value),
    captionScale: Number(captionScaleInput.value),
    panels: Array.from({ length: count }, (_, i) => ({
      img: state.slots[state.panelPhoto[i]] ?? null,
      ...state.transforms[i],
    })),
  };
}

function redraw() {
  const [w, h] = state.size;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCoverArt(ctx, w, h, currentArt());
  panelPhotoLabel.textContent = `Slot ${state.panelPhoto[state.selectedPanel] + 1}`;
  panelZoomInput.value = state.transforms[state.selectedPanel].zoom;
}

async function setSlot(i, img, name) {
  state.slots[i] = img;
  state.slotNames[i] = name;
  document.querySelector(`#slot-file-${i}`).textContent = name;
  redraw();
}

function firstEmptySlot() {
  const i = state.slots.findIndex((s) => !s);
  return i === -1 ? 3 : i;
}

// Photo slot rows: a file picker and a clear button per slot.
const slotsEl = document.getElementById('photoSlots');
for (let i = 0; i < 4; i++) {
  const row = document.createElement('div');
  row.className = 'slot';
  row.innerHTML = `<span class="slot-name">Slot ${i + 1}</span><span class="slot-file" id="slot-file-${i}">empty</span>`;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.setAttribute('aria-label', `Photo for slot ${i + 1}`);
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    await setSlot(i, await loadImage(URL.createObjectURL(file)), file.name);
    status.textContent = `Slot ${i + 1} holds ${file.name}. Click a panel, then pick which slot it shows.`;
  });
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Clear';
  clear.addEventListener('click', () => setSlot(i, null, 'empty'));
  row.append(input, clear);
  slotsEl.append(row);
}

document.querySelectorAll('[data-sample]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const name = btn.dataset.sample;
    const img = await loadImage(`samples/${name}.jpg`);
    await setSlot(firstEmptySlot(), img, `${name}.jpg (sample)`);
  });
});

document.querySelectorAll('#templateRow [data-template]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.template = btn.dataset.template;
    state.selectedPanel = 0;
    document.querySelectorAll('#templateRow [data-template]').forEach((b) => b.classList.toggle('active', b === btn));
    redraw();
  });
});

document.querySelectorAll('#sizeRow [data-size]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.size = btn.dataset.size.split('x').map(Number);
    document.querySelectorAll('#sizeRow [data-size]').forEach((b) => b.classList.toggle('active', b === btn));
    redraw();
  });
});

function cyclePanelPhoto(step) {
  const cur = state.panelPhoto[state.selectedPanel];
  state.panelPhoto[state.selectedPanel] = (cur + step + 4) % 4;
  redraw();
}
document.getElementById('panelPhotoPrev').addEventListener('click', () => cyclePanelPhoto(-1));
document.getElementById('panelPhotoNext').addEventListener('click', () => cyclePanelPhoto(1));
panelZoomInput.addEventListener('input', () => {
  state.transforms[state.selectedPanel].zoom = Number(panelZoomInput.value);
  redraw();
});
[captionInput, subcaptionInput].forEach((el) => el.addEventListener('input', redraw));
[gradeInput, captionScaleInput].forEach((el) => el.addEventListener('input', redraw));

// Drag to reposition the selected panel's photo; wheel zooms it.
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) * (canvas.width / r.width), (e.clientY - r.top) * (canvas.height / r.height)];
}
canvas.addEventListener('pointerdown', (e) => {
  const [x, y] = canvasPoint(e);
  const i = panelAt(state.template, canvas.width, canvas.height, x, y);
  if (i >= 0) state.selectedPanel = i;
  drag = { x, y };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const [x, y] = canvasPoint(e);
  const t = state.transforms[state.selectedPanel];
  const img = state.slots[state.panelPhoto[state.selectedPanel]];
  const panel = panelLayout(state.template, canvas.width, canvas.height)[state.selectedPanel];
  if (img && panel) {
    const scale = Math.max(panel.box.w / img.naturalWidth, panel.box.h / img.naturalHeight) * t.zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    if (dw > panel.box.w) t.focalX = Math.min(1, Math.max(0, t.focalX - (x - drag.x) / (dw - panel.box.w)));
    if (dh > panel.box.h) t.focalY = Math.min(1, Math.max(0, t.focalY - (y - drag.y) / (dh - panel.box.h)));
  }
  drag = { x, y };
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const t = state.transforms[state.selectedPanel];
  t.zoom = Math.min(3, Math.max(1, t.zoom * (e.deltaY < 0 ? 1.07 : 0.93)));
  redraw();
}, { passive: false });

document.getElementById('export').addEventListener('click', () => {
  const [w, h] = state.size;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  drawCoverArt(out.getContext('2d'), w, h, currentArt());
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved vice-cover-${w}x${h}.png`;
  }, 'image/png');
});

/** Builds a whole scene at once — the screenshot path, and the editor's opening scene. */
async function applyScene(cfg) {
  state.template = cfg.template;
  state.size = cfg.size;
  captionInput.value = cfg.caption;
  subcaptionInput.value = cfg.subcaption;
  gradeInput.value = cfg.grade;
  for (let i = 0; i < cfg.photos.length && i < 4; i++) {
    const name = cfg.photos[i];
    await setSlot(i, await loadImage(`samples/${name}.jpg`), `${name}.jpg (sample)`);
  }
  cfg.panels.forEach((slot, i) => { if (i < 4) state.panelPhoto[i] = slot; });
  (cfg.focus ?? []).forEach(([fx, fy], i) => {
    if (i < 4 && Number.isFinite(fx) && Number.isFinite(fy)) {
      state.transforms[i].focalX = Math.min(1, Math.max(0, fx));
      state.transforms[i].focalY = Math.min(1, Math.max(0, fy));
    }
  });
  document.querySelectorAll('#templateRow [data-template]').forEach((b) => b.classList.toggle('active', b.dataset.template === cfg.template));
  document.querySelectorAll('#sizeRow [data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === cfg.size.join('x')));
  await document.fonts.load('100px Anton');
  redraw();
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, applyScene);
} else {
  applyScene({
    template: 'hero',
    size: [1080, 1350],
    caption: 'VICE HEAT',
    subcaption: 'LEONIDA DREAMS',
    grade: 0.65,
    photos: ['rider', 'queen', 'boulevard'],
    panels: [0, 1, 2, 3],
  });
  document.fonts.ready.then(redraw);
}

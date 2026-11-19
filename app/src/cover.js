// Vice Cover Studio renderer: draws a multi-panel, GTA-poster-style cover onto a 2D canvas.
//
// A cover is a set of panels (polygons in canvas fractions). Each panel shows one photo placed
// by a focal point and a zoom, drawn cover-fit inside the panel's clip. Over the panels goes the
// Vice City grade — a sunset-to-neon wash plus a vignette — then crisp white panel borders, and
// finally the caption: a gold subtitle over a big Anton title with a magenta offset shadow and a
// black outline, the way a game poster shouts.

/** Panel polygons per template, as [x, y] points in fractions of the canvas size. */
export const TEMPLATES = {
  hero: [
    [[0, 0], [0.58, 0], [0.58, 1], [0, 1]],
    [[0.58, 0], [1, 0], [1, 0.52], [0.58, 0.52]],
    [[0.58, 0.52], [1, 0.52], [1, 1], [0.58, 1]],
  ],
  quad: [
    [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]],
    [[0.5, 0], [1, 0], [1, 0.5], [0.5, 0.5]],
    [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]],
    [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]],
  ],
  slash: [
    [[0, 0], [0.4, 0], [0.32, 1], [0, 1]],
    [[0.4, 0], [0.7, 0], [0.62, 1], [0.32, 1]],
    [[0.7, 0], [1, 0], [1, 1], [0.62, 1]],
  ],
};

/** The panels of a template in pixels: each entry is { points, box } with box the bounding rect. */
export function panelLayout(template, w, h) {
  return (TEMPLATES[template] ?? TEMPLATES.hero).map((poly) => {
    const points = poly.map(([fx, fy]) => [fx * w, fy * h]);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { points, box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } };
  });
}

/** Index of the panel under a pixel point, or -1. Used by the editor for click and drag. */
export function panelAt(template, w, h, px, py) {
  const layout = panelLayout(template, w, h);
  for (let i = layout.length - 1; i >= 0; i--) {
    const pts = layout[i].points;
    let inside = false;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
      const [ax, ay] = pts[a];
      const [bx, by] = pts[b];
      if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
    }
    if (inside) return i;
  }
  return -1;
}

function tracePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

/** Draws an image cover-fit into a box, the visible window set by the focal point and zoom. */
function drawPhotoInBox(ctx, img, box, focalX, focalY, zoom) {
  const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = box.x + (box.w - dw) * focalX;
  const dy = box.y + (box.h - dh) * focalY;
  ctx.drawImage(img, dx, dy, dw, dh);
  return { dw, dh };
}

function drawPlaceholder(ctx, box, w, h) {
  const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  g.addColorStop(0, '#3b1160');
  g.addColorStop(1, '#0e4a5e');
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `600 ${Math.round(h * 0.02)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ADD A PHOTO', box.x + box.w / 2, box.y + box.h / 2);
}

/** The sunset-to-neon wash and vignette that give the cover its Vice City grade. */
function applyGrade(ctx, w, h, grade) {
  if (grade <= 0) return;
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, `rgba(255, 47, 149, ${0.3 * grade})`);
  wash.addColorStop(0.42, `rgba(255, 110, 60, ${0.15 * grade})`);
  wash.addColorStop(0.74, `rgba(120, 40, 180, ${0.1 * grade})`);
  wash.addColorStop(1, `rgba(0, 190, 230, ${0.2 * grade})`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(8, 0, 18, 0)');
  vig.addColorStop(1, `rgba(8, 0, 18, ${0.34 * grade})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function fitFontPx(ctx, text, maxWidth, startPx) {
  let px = startPx;
  ctx.font = `${px}px Anton, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && px > 10) {
    px -= 2;
    ctx.font = `${px}px Anton, sans-serif`;
  }
  return px;
}

function drawCaption(ctx, w, h, caption, subcaption, captionScale) {
  const title = caption.trim().toUpperCase();
  const sub = subcaption.trim().toUpperCase();
  if (!title && !sub) return;
  const scrim = ctx.createLinearGradient(0, h * 0.58, 0, h);
  scrim.addColorStop(0, 'rgba(8, 2, 16, 0)');
  scrim.addColorStop(1, 'rgba(8, 2, 16, 0.66)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.58, w, h * 0.42);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  const titlePx = title ? fitFontPx(ctx, title, w * 0.93, h * 0.118 * captionScale) : 0;
  const titleBaseY = h * 0.945;
  if (sub) {
    const px = fitFontPx(ctx, sub, w * 0.9, h * 0.034 * captionScale);
    const subY = title ? titleBaseY - titlePx * 1.34 : h * 0.93;
    try { ctx.letterSpacing = `${Math.round(px * 0.34)}px`; } catch { /* older canvas: no letter spacing */ }
    ctx.lineWidth = px * 0.14;
    ctx.strokeStyle = '#12041f';
    ctx.fillStyle = '#ffd23f';
    ctx.strokeText(sub, w / 2, subY);
    ctx.fillText(sub, w / 2, subY);
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }
  if (title) {
    const px = titlePx;
    ctx.font = `${px}px Anton, sans-serif`;
    ctx.fillStyle = '#ff2d95';
    ctx.fillText(title, w / 2 + px * 0.045, titleBaseY + px * 0.05);
    ctx.lineWidth = px * 0.17;
    ctx.strokeStyle = '#0d0218';
    ctx.strokeText(title, w / 2, titleBaseY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, w / 2, titleBaseY);
  }
}

/**
 * Draws the whole cover described by `art` at w x h:
 * art = { template, caption, subcaption, grade, captionScale,
 *         panels: [{ img, focalX, focalY, zoom }] } — one entry per panel of the template.
 */
export function drawCoverArt(ctx, w, h, art) {
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, w, h);
  const layout = panelLayout(art.template, w, h);
  layout.forEach((panel, i) => {
    const p = art.panels[i] ?? { img: null, focalX: 0.5, focalY: 0.5, zoom: 1 };
    ctx.save();
    tracePath(ctx, panel.points);
    ctx.clip();
    if (p.img) {
      ctx.filter = `saturate(${1 + 0.4 * art.grade}) contrast(${1 + 0.07 * art.grade})`;
      drawPhotoInBox(ctx, p.img, panel.box, p.focalX, p.focalY, p.zoom);
      ctx.filter = 'none';
    } else {
      drawPlaceholder(ctx, panel.box, w, h);
    }
    ctx.restore();
  });
  applyGrade(ctx, w, h, art.grade);
  const border = Math.max(3, w * 0.0055);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = border;
  layout.forEach((panel) => {
    tracePath(ctx, panel.points);
    ctx.stroke();
  });
  ctx.lineWidth = border * 1.5;
  ctx.strokeRect(0, 0, w, h);
  drawCaption(ctx, w, h, art.caption, art.subcaption, art.captionScale);
}

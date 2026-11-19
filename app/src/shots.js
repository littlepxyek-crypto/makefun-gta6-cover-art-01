// Fixed scenes for screenshots: ?shot=cover shows the finished cover alone, filling the frame;
// ?shot=editor shows the studio with a scene loaded. The scene comes from the query:
//   template=hero|quad|slash   size=1080x1350   caption=...   sub=...   grade=0..1
//   photos=rider,queen,boulevard (sample names, one per photo slot)
//   panels=0,1,2 (which slot each panel shows)
//   focus=0.5,0.4;0.6,0.35 (optional per-panel focal points, so faces land inside narrow panels)
// window.__shotReady is set once the scene is painted, so the screenshot waits for real pixels.

export async function runShot(shot, query, applyScene) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const [w, h] = (query.get('size') ?? '1920x1080').split('x').map(Number);
  await applyScene({
    template: query.get('template') ?? 'hero',
    size: [w || 1920, h || 1080],
    caption: query.get('caption') ?? 'VICE HEAT',
    subcaption: query.get('sub') ?? 'LEONIDA DREAMS',
    grade: Number(query.get('grade') ?? 0.65),
    photos: (query.get('photos') ?? 'rider,queen,boulevard').split(',').map((s) => s.trim()).filter(Boolean),
    panels: (query.get('panels') ?? '0,1,2,3').split(',').map((s) => Number(s.trim()) || 0),
    focus: (query.get('focus') ?? '').split(';').filter(Boolean).map((pair) => pair.split(',').map(Number)),
  });
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

// confetti.js — tiny, dependency-free celebration burst for milestone moments.
// Theme colors, respects prefers-reduced-motion, cleans up its own canvas.
const COLORS = ['#2f5d3f', '#4a9e6a', '#c9a227', '#f4f1ea'];

export function burst(opts = {}) {
  try {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  } catch (e) { /* ignore */ }

  const count = opts.count || 90;
  const origin = opts.origin || { x: 0.5, y: 0.4 };
  const colors = opts.colors || COLORS;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  const w = (canvas.width = window.innerWidth);
  const h = (canvas.height = window.innerHeight);
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const ox = origin.x * w, oy = origin.y * h;

  const parts = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.7; // fan upward
    const speed = 5 + Math.random() * 9;
    parts.push({
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - Math.random() * 2,
      size: 5 + Math.random() * 6,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      life: 0, ttl: 70 + Math.random() * 45,
    });
  }

  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, w, h);
    let alive = false;
    for (const p of parts) {
      if (p.life > p.ttl) continue;
      p.life++; alive = true;
      p.vy += 0.3; p.vx *= 0.99;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.ttl);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
      ctx.restore();
    }
    frame++;
    if (alive && frame < 200) requestAnimationFrame(tick);
    else canvas.remove();
  }
  requestAnimationFrame(tick);
}

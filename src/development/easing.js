/** CSS-equivalent cubic-bezier easing, so camera flights follow the same curves as the interface. */
export function cubicBezier(x1, y1, x2, y2) {
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const sampleX = t => ((ax * t + bx) * t + cx) * t;
  const sampleY = t => ((ay * t + by) * t + cy) * t;
  const slopeX = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      const slope = slopeX(t);
      if (Math.abs(error) < 1e-6 || Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    if (t < 0 || t > 1) {
      let low = 0, high = 1;
      t = x;
      for (let i = 0; i < 24; i += 1) { if (sampleX(t) < x) low = t; else high = t; t = (low + high) / 2; }
    }
    return sampleY(t);
  };
}

export const easeInOut = cubicBezier(0.77, 0, 0.175, 1);
export const easeOut = cubicBezier(0.23, 1, 0.32, 1);

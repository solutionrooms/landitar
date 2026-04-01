import { Vec2 } from './vec2.js';

export interface Segment {
  x1: number; y1: number;
  x2: number; y2: number;
}

/** Test if two line segments intersect. Returns intersection point or null. */
export function segmentIntersection(a: Segment, b: Segment): Vec2 | null {
  const dx1 = a.x2 - a.x1, dy1 = a.y2 - a.y1;
  const dx2 = b.x2 - b.x1, dy2 = b.y2 - b.y1;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((b.x1 - a.x1) * dy2 - (b.y1 - a.y1) * dx2) / denom;
  const u = ((b.x1 - a.x1) * dy1 - (b.y1 - a.y1) * dx1) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return new Vec2(a.x1 + t * dx1, a.y1 + t * dy1);
  }
  return null;
}

/** Test if a point is within distance of a line segment. */
export function pointToSegmentDist(px: number, py: number, seg: Segment): number {
  const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - seg.x1) ** 2 + (py - seg.y1) ** 2);

  let t = ((px - seg.x1) * dx + (py - seg.y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = seg.x1 + t * dx;
  const closestY = seg.y1 + t * dy;
  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

/** Test circle vs array of segments. Returns true if any collision. */
export function circleVsSegments(cx: number, cy: number, radius: number, segments: Segment[]): boolean {
  for (const seg of segments) {
    if (pointToSegmentDist(cx, cy, seg) < radius) return true;
  }
  return false;
}

/** Find the closest colliding segment and return the outward normal + penetration depth. */
export function circleVsSegmentsInfo(
  cx: number, cy: number, radius: number, segments: Segment[],
): { normalX: number; normalY: number; depth: number } | null {
  let bestDist = radius;
  let bestNx = 0, bestNy = 0;

  for (const seg of segments) {
    const dist = pointToSegmentDist(cx, cy, seg);
    if (dist < bestDist) {
      bestDist = dist;
      // Normal points from closest point on segment toward circle center
      const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq === 0 ? 0 : ((cx - seg.x1) * dx + (cy - seg.y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      let nx = cx - (seg.x1 + t * dx);
      let ny = cy - (seg.y1 + t * dy);
      const nl = Math.sqrt(nx * nx + ny * ny);
      if (nl > 0.001) {
        bestNx = nx / nl;
        bestNy = ny / nl;
      }
    }
  }

  return bestDist < radius ? { normalX: bestNx, normalY: bestNy, depth: radius - bestDist } : null;
}

/** Test if a line of sight between two points is blocked by any terrain segment. */
export function hasLineOfSight(ax: number, ay: number, bx: number, by: number, segments: Segment[]): boolean {
  const los: Segment = { x1: ax, y1: ay, x2: bx, y2: by };
  for (const seg of segments) {
    if (segmentIntersection(los, seg)) return false;
  }
  return true;
}

/** Get segments of a shape rotated and translated */
export function transformSegments(
  segments: Segment[],
  x: number, y: number, angle: number, scale = 1
): Segment[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return segments.map(s => ({
    x1: x + (s.x1 * cos - s.y1 * sin) * scale,
    y1: y + (s.x1 * sin + s.y1 * cos) * scale,
    x2: x + (s.x2 * cos - s.y2 * sin) * scale,
    y2: y + (s.x2 * sin + s.y2 * cos) * scale,
  }));
}

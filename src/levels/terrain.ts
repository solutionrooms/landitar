import { type Segment, pointToSegmentDist } from '../math/collision.js';

const SEGMENT_MAX_HP = 5; // hits to destroy a segment

export class Terrain {
  segments: Segment[] = [];
  /** Health per segment. When <= 0, segment is destroyed (gap in wall). */
  segmentHp: number[] = [];
  /** Tracks which segments are indestructible (spike walls, islands) */
  private indestructibleFrom = 0; // segments added after construction are indestructible
  points: { x: number; y: number }[];

  constructor(points: { x: number; y: number }[], closed: boolean) {
    this.points = points;
    for (let i = 0; i < points.length - 1; i++) {
      this.segments.push({
        x1: points[i].x,
        y1: points[i].y,
        x2: points[i + 1].x,
        y2: points[i + 1].y,
      });
      this.segmentHp.push(SEGMENT_MAX_HP);
    }
    if (closed && points.length > 2) {
      this.segments.push({
        x1: points[points.length - 1].x,
        y1: points[points.length - 1].y,
        x2: points[0].x,
        y2: points[0].y,
      });
      this.segmentHp.push(SEGMENT_MAX_HP);
    }
    // Mark everything added so far as destructible; anything pushed later is not
    this.indestructibleFrom = this.segments.length;
  }

  /** Add segments after construction (spike walls, islands) — these are indestructible */
  addSegments(segs: Segment[]) {
    for (const s of segs) {
      this.segments.push(s);
      this.segmentHp.push(-1); // -1 = indestructible
    }
  }

  /** Damage the segment closest to (x, y). Returns true if a segment was destroyed. */
  damageAt(x: number, y: number, amount = 1): boolean {
    let bestIdx = -1;
    let bestDist = 20; // max range for damage
    for (let i = 0; i < this.segments.length; i++) {
      if (this.segmentHp[i] <= 0 && this.segmentHp[i] !== -1) continue; // already dead
      if (this.segmentHp[i] === -1) continue; // indestructible
      const d = pointToSegmentDist(x, y, this.segments[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return false;
    this.segmentHp[bestIdx] -= amount;
    return this.segmentHp[bestIdx] <= 0;
  }

  /** Check if a segment is alive (for collision/rendering) */
  isAlive(i: number): boolean {
    const hp = this.segmentHp[i];
    return hp > 0 || hp === -1;
  }

  /** Get damage ratio 0-1 for visual feedback */
  getDamageRatio(i: number): number {
    const hp = this.segmentHp[i];
    if (hp === -1 || hp >= SEGMENT_MAX_HP) return 0;
    if (hp <= 0) return 1;
    return 1 - hp / SEGMENT_MAX_HP;
  }

  /** Get the lowest (floor) Y value of terrain at a given X.
   *  When multiple segments span the same X (e.g. overhangs), returns the minimum Y. */
  getYAtX(x: number): number | null {
    let minY: number | null = null;
    for (let i = 0; i < this.segments.length; i++) {
      if (!this.isAlive(i)) continue;
      const seg = this.segments[i];
      if ((seg.x1 <= x && x <= seg.x2) || (seg.x2 <= x && x <= seg.x1)) {
        const t = (x - seg.x1) / (seg.x2 - seg.x1);
        const y = seg.y1 + t * (seg.y2 - seg.y1);
        if (minY === null || y < minY) minY = y;
      }
    }
    return minY;
  }
}

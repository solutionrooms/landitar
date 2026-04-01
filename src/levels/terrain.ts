import { type Segment } from '../math/collision.js';

export class Terrain {
  segments: Segment[] = [];
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
    }
    if (closed && points.length > 2) {
      this.segments.push({
        x1: points[points.length - 1].x,
        y1: points[points.length - 1].y,
        x2: points[0].x,
        y2: points[0].y,
      });
    }
  }

  /** Get the lowest (floor) Y value of terrain at a given X.
   *  When multiple segments span the same X (e.g. overhangs), returns the minimum Y. */
  getYAtX(x: number): number | null {
    let minY: number | null = null;
    for (const seg of this.segments) {
      if ((seg.x1 <= x && x <= seg.x2) || (seg.x2 <= x && x <= seg.x1)) {
        const t = (x - seg.x1) / (seg.x2 - seg.x1);
        const y = seg.y1 + t * (seg.y2 - seg.y1);
        if (minY === null || y < minY) minY = y;
      }
    }
    return minY;
  }
}

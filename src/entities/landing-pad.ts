import { Vec2 } from '../math/vec2.js';
import { type Segment } from '../math/collision.js';
import { type Renderer } from '../render/renderer.js';
import { settings } from '../core/settings.js';

const PAD_COLOR = '#FFFF00';
const STILT_COLOR = '#888800';

/** Function to query terrain Y at a given X */
export type TerrainYFn = (x: number) => number | null;

export class LandingPad {
  pos: Vec2;           // center of the platform top surface
  private leftLegY: number;
  private rightLegY: number;

  constructor(x: number, groundY: number, terrainYFn?: TerrainYFn) {
    const hw = settings.padWidth / 2;
    // Query terrain Y at each leg position so legs reach the actual ground
    const leftX = x - hw + 3;
    const rightX = x + hw - 3;
    this.leftLegY = terrainYFn?.(leftX) ?? groundY;
    this.rightLegY = terrainYFn?.(rightX) ?? groundY;
    // Pad sits at the higher of the two leg ground points + padHeight
    const baseY = Math.max(this.leftLegY, this.rightLegY);
    this.pos = new Vec2(x, baseY + settings.padHeight);
  }

  get left(): number { return this.pos.x - settings.padWidth / 2; }
  get right(): number { return this.pos.x + settings.padWidth / 2; }
  get top(): number { return this.pos.y; }

  /** Check if ship is making a valid landing. Returns 'landed' | 'crashed' | null */
  checkLanding(shipX: number, shipY: number, shipVelY: number, shipAngle: number, shipRadius: number): 'landed' | 'crashed' | null {
    const hw = settings.padWidth / 2;
    if (shipX < this.pos.x - hw || shipX > this.pos.x + hw) return null;
    if (shipY > this.pos.y + shipRadius + 2) return null;
    if (shipY < this.pos.y - 3) return null;

    const angleDev = Math.abs(shipAngle - Math.PI / 2);
    const angleDevNorm = angleDev > Math.PI ? Math.PI * 2 - angleDev : angleDev;
    const maxAngleRad = (settings.maxLandingAngle * Math.PI) / 180;

    const tooFast = Math.abs(shipVelY) > settings.maxLandingSpeed;
    const tooTilted = angleDevNorm > maxAngleRad;

    if (tooFast || tooTilted) return 'crashed';
    return 'landed';
  }

  getSegments(): Segment[] {
    const hw = settings.padWidth / 2;
    const gx = this.pos.x;
    const ty = this.pos.y;

    return [
      // Platform surface
      { x1: gx - hw, y1: ty, x2: gx + hw, y2: ty },
      // Left leg: from terrain to platform
      { x1: gx - hw + 3, y1: this.leftLegY, x2: gx - hw + 3, y2: ty },
      // Right leg: from terrain to platform
      { x1: gx + hw - 3, y1: this.rightLegY, x2: gx + hw - 3, y2: ty },
    ];
  }

  render(renderer: Renderer) {
    const segs = this.getSegments();
    renderer.drawSegments([segs[1], segs[2]], STILT_COLOR, 2);
    renderer.drawSegments([segs[0]], PAD_COLOR, 3);
  }
}

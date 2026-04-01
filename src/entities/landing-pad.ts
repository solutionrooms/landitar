import { Vec2 } from '../math/vec2.js';
import { type Segment } from '../math/collision.js';
import { type Renderer } from '../render/renderer.js';
import { settings } from '../core/settings.js';

const PAD_COLOR = '#FFFF00';
const STILT_COLOR = '#888800';

export class LandingPad {
  pos: Vec2;           // center of the platform top surface
  groundY: number;     // terrain Y at this x position

  constructor(x: number, groundY: number) {
    this.groundY = groundY;
    this.pos = new Vec2(x, groundY + settings.padHeight);
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
    const h = settings.padHeight;
    const gx = this.pos.x;
    const gy = this.groundY;
    const ty = gy + h;

    return [
      { x1: gx - hw, y1: ty, x2: gx + hw, y2: ty },
      { x1: gx - hw + 3, y1: gy, x2: gx - hw + 3, y2: ty },
      { x1: gx + hw - 3, y1: gy, x2: gx + hw - 3, y2: ty },
    ];
  }

  render(renderer: Renderer) {
    const segs = this.getSegments();
    renderer.drawSegments([segs[1], segs[2]], STILT_COLOR, 2);
    renderer.drawSegments([segs[0]], PAD_COLOR, 3);
  }
}

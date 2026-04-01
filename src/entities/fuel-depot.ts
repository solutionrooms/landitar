import { Vec2 } from '../math/vec2.js';
import { type Segment, transformSegments } from '../math/collision.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';

const FUEL_AMOUNT = 2500;
const GRAB_SPEED = 300;

const DEPOT_SHAPE: Segment[] = [
  { x1: -5, y1: 0, x2: -5, y2: 8 },
  { x1: -5, y1: 8, x2: 5, y2: 8 },
  { x1: 5, y1: 8, x2: 5, y2: 0 },
  { x1: 5, y1: 0, x2: -5, y2: 0 },
];

export interface FuelDepotDef {
  x: number;
  y: number;
}

export class FuelDepot {
  pos: Vec2;
  alive = true;
  grabbed = false;       // animating toward ship
  readonly fuelAmount = FUEL_AMOUNT;

  constructor(def: FuelDepotDef) {
    this.pos = new Vec2(def.x, def.y);
  }

  /** Call each frame while grabbed - returns true when reached the ship */
  updateGrab(dt: number, shipPos: Vec2): boolean {
    if (!this.grabbed) return false;
    const diff = shipPos.sub(this.pos);
    const dist = diff.length();
    if (dist < 10) return true; // arrived
    this.pos.addMut(diff.normalize().scale(GRAB_SPEED * dt));
    return false;
  }

  render(renderer: Renderer) {
    if (!this.alive) return;
    const scale = this.grabbed ? 0.7 : 1;
    const segs = transformSegments(DEPOT_SHAPE, this.pos.x, this.pos.y, 0, scale);
    renderer.drawSegments(segs, this.grabbed ? Colors.shield : Colors.fuelDepot, 2);
  }
}

import { Vec2 } from '../math/vec2.js';
import { type Segment, transformSegments } from '../math/collision.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';

const FUEL_AMOUNT = 2500;
const PICKUP_RANGE = 30;

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
  readonly pickupRange = PICKUP_RANGE;
  readonly fuelAmount = FUEL_AMOUNT;

  constructor(def: FuelDepotDef) {
    this.pos = new Vec2(def.x, def.y);
  }

  render(renderer: Renderer) {
    if (!this.alive) return;
    const segs = transformSegments(DEPOT_SHAPE, this.pos.x, this.pos.y, 0);
    renderer.drawSegments(segs, Colors.fuelDepot, 2);
  }
}

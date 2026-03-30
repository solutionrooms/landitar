export class Vec2 {
  constructor(public x: number = 0, public y: number = 0) {}

  static zero() { return new Vec2(0, 0); }
  static fromAngle(angle: number, length = 1) {
    return new Vec2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  clone() { return new Vec2(this.x, this.y); }
  set(x: number, y: number) { this.x = x; this.y = y; return this; }
  copy(v: Vec2) { this.x = v.x; this.y = v.y; return this; }

  add(v: Vec2) { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v: Vec2) { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s: number) { return new Vec2(this.x * s, this.y * s); }
  negate() { return new Vec2(-this.x, -this.y); }

  addMut(v: Vec2) { this.x += v.x; this.y += v.y; return this; }
  subMut(v: Vec2) { this.x -= v.x; this.y -= v.y; return this; }
  scaleMut(s: number) { this.x *= s; this.y *= s; return this; }

  dot(v: Vec2) { return this.x * v.x + this.y * v.y; }
  cross(v: Vec2) { return this.x * v.y - this.y * v.x; }

  length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  lengthSq() { return this.x * this.x + this.y * this.y; }

  normalize() {
    const len = this.length();
    return len > 0 ? this.scale(1 / len) : Vec2.zero();
  }

  rotate(angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
  }

  distanceTo(v: Vec2) { return this.sub(v).length(); }
  angleTo(v: Vec2) { return Math.atan2(v.y - this.y, v.x - this.x); }
}

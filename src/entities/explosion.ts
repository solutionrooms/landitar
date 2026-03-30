import { Vec2 } from '../math/vec2.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';

interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
}

const PARTICLE_COUNT = 12;
const PARTICLE_SPEED = 150;
const PARTICLE_LIFE = 0.8;

export class Explosion {
  private particles: Particle[] = [];
  public done = false;

  constructor(x: number, y: number, count = PARTICLE_COUNT) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = PARTICLE_SPEED * (0.5 + Math.random() * 0.5);
      this.particles.push({
        pos: new Vec2(x, y),
        vel: Vec2.fromAngle(angle, speed),
        life: PARTICLE_LIFE * (0.5 + Math.random() * 0.5),
      });
    }
  }

  update(dt: number) {
    let alive = false;
    for (const p of this.particles) {
      p.pos.addMut(p.vel.scale(dt));
      p.life -= dt;
      if (p.life > 0) alive = true;
    }
    if (!alive) this.done = true;
  }

  render(renderer: Renderer) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      const alpha = p.life / PARTICLE_LIFE;
      const color = alpha > 0.5 ? Colors.explosion : Colors.turret;
      renderer.drawCircle(p.pos.x, p.pos.y, 1 + alpha * 2, color, 2);
    }
  }
}

import { type Segment } from '../math/collision.js';

export class Renderer {
  public ctx: CanvasRenderingContext2D;
  public width: number;
  public height: number;

  // Camera
  public camX = 0;
  public camY = 0;
  public camScale = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  beginFrame() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  /** Convert world X to screen X */
  sx(wx: number): number {
    return (wx - this.camX) * this.camScale + this.width / 2;
  }

  /** Convert world Y to screen Y (Y-up to Y-down) */
  sy(wy: number): number {
    return -(wy - this.camY) * this.camScale + this.height / 2;
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 1.5) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(this.sx(x1), this.sy(y1));
    this.ctx.lineTo(this.sx(x2), this.sy(y2));
    this.ctx.stroke();
  }

  drawSegments(segments: Segment[], color: string, lineWidth = 1.5) {
    if (segments.length === 0) return;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    for (const s of segments) {
      this.ctx.moveTo(this.sx(s.x1), this.sy(s.y1));
      this.ctx.lineTo(this.sx(s.x2), this.sy(s.y2));
    }
    this.ctx.stroke();
  }

  drawCircle(x: number, y: number, radius: number, color: string, lineWidth = 1.5) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.arc(this.sx(x), this.sy(y), radius * this.camScale, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  drawFilledCircle(x: number, y: number, radius: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(this.sx(x), this.sy(y), radius * this.camScale, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /** Draw text in screen coordinates (not world) */
  drawText(text: string, screenX: number, screenY: number, color: string, size = 14, align: CanvasTextAlign = 'left') {
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px monospace`;
    this.ctx.textAlign = align;
    this.ctx.fillText(text, screenX, screenY);
  }

  /** Draw a polygon outline from points */
  drawPolygon(points: { x: number; y: number }[], color: string, closed = true, lineWidth = 1.5) {
    if (points.length < 2) return;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(this.sx(points[0].x), this.sy(points[0].y));
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(this.sx(points[i].x), this.sy(points[i].y));
    }
    if (closed) this.ctx.closePath();
    this.ctx.stroke();
  }
}

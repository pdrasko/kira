import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera   = camera;
    this.yaw      = Math.PI;   // start behind player
    this.pitch    = 0.45;
    this.distance = 14;
    this._lastMX  = 0;
    this._dragging = false;
  }

  init() {
    document.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastMX;
      this._lastMX = e.clientX;
      this.yaw -= dx * 0.005;
    });
    document.addEventListener('mousedown', e => {
      if (e.button === 2) { this._dragging = true; this._lastMX = e.clientX; }
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 2) this._dragging = false;
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => {
      this.distance = Math.max(5, Math.min(25, this.distance + e.deltaY * 0.02));
    });
  }

  update(targetPos) {
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const sinP = Math.sin(this.pitch);
    const cosP = Math.cos(this.pitch);

    this.camera.position.set(
      targetPos.x + this.distance * sinY * cosP,
      targetPos.y + this.distance * sinP,
      targetPos.z + this.distance * cosY * cosP
    );
    this.camera.lookAt(targetPos.x, targetPos.y + 0.5, targetPos.z);
  }

  getYaw() { return this.yaw; }
}

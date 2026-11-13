import * as THREE from 'three';

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Snow spray kicked up by the board.
export class Spray {
  constructor(scene, n = 700) {
    this.n = n;
    this.pos = new Float32Array(n * 3).fill(-9999);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTexture(), size: 0.55, transparent: true, opacity: 0.85, depthWrite: false, color: 0xffffff, sizeAttenuation: true }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(p, v, count, spread = 2.5, upv = 2.5) {
    for (let i = 0; i < count; i++) {
      const k = this.next = (this.next + 1) % this.n, o = k * 3;
      this.pos[o] = p.x + (Math.random() - 0.5) * 0.6;
      this.pos[o + 1] = p.y + 0.05;
      this.pos[o + 2] = p.z + (Math.random() - 0.5) * 0.6;
      this.vel[o] = v.x + (Math.random() - 0.5) * spread;
      this.vel[o + 1] = v.y + Math.random() * upv;
      this.vel[o + 2] = v.z + (Math.random() - 0.5) * spread;
      this.life[k] = 0.5 + Math.random() * 0.6;
    }
  }
  update(dt) {
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) continue;
      const o = k * 3;
      this.life[k] -= dt;
      if (this.life[k] <= 0) { this.pos[o + 1] = -9999; continue; }
      this.vel[o + 1] -= 9 * dt;
      const d = 1 - 1.5 * dt;
      this.vel[o] *= d; this.vel[o + 2] *= d;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// Carved track left in the snow: a ring buffer of quads.
export class Trail {
  constructor(scene, n = 500) {
    this.n = n; this.i = 0; this.has = false;
    this.pos = new Float32Array(n * 12);
    const idx = [];
    for (let k = 0; k < n; k++) idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 1, k * 4 + 3, k * 4 + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xb9cde6, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.l = new THREE.Vector3(); this.r = new THREE.Vector3(); this.last = new THREE.Vector3();
  }
  break() { this.has = false; }
  reset() { this.pos.fill(0); this.has = false; this.mesh.geometry.attributes.position.needsUpdate = true; }
  // p: ground point, side: unit vector across the travel direction, n: normal, w: half width
  add(p, side, n, w) {
    if (this.has && this.last.distanceToSquared(p) < 0.2) return;
    const lx = p.x - side.x * w + n.x * 0.04, ly = p.y - side.y * w + n.y * 0.04, lz = p.z - side.z * w + n.z * 0.04;
    const rx = p.x + side.x * w + n.x * 0.04, ry = p.y + side.y * w + n.y * 0.04, rz = p.z + side.z * w + n.z * 0.04;
    if (this.has) {
      const o = this.i * 12;
      this.pos.set([this.l.x, this.l.y, this.l.z, this.r.x, this.r.y, this.r.z, lx, ly, lz, rx, ry, rz], o);
      this.i = (this.i + 1) % this.n;
      this.mesh.geometry.attributes.position.needsUpdate = true;
    }
    this.l.set(lx, ly, lz); this.r.set(rx, ry, rz); this.last.copy(p); this.has = true;
  }
}

// Ambient snowfall wrapped in a box around the camera.
export class Snowfall {
  constructor(scene, n = 1400) {
    this.n = n; this.box = 60;
    this.pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) this.pos[i] = (Math.random() - 0.5) * this.box;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTexture(), size: 0.22, transparent: true, opacity: 0.8, depthWrite: false, sizeAttenuation: true }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.prev = new THREE.Vector3();
  }
  update(dt, cam) {
    const b = this.box, h = b / 2;
    const dx = cam.x - this.prev.x, dy = cam.y - this.prev.y, dz = cam.z - this.prev.z;
    this.prev.copy(cam);
    for (let i = 0; i < this.n; i++) {
      const o = i * 3;
      let x = this.pos[o] - dx + 1.2 * dt, y = this.pos[o + 1] - dy - 3.2 * dt, z = this.pos[o + 2] - dz;
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > b) { x = (Math.random() - 0.5) * b; y = (Math.random() - 0.5) * b; z = (Math.random() - 0.5) * b; }
      x = ((((x + h) % b) + b) % b) - h; y = ((((y + h) % b) + b) % b) - h; z = ((((z + h) % b) + b) % b) - h;
      this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    }
    this.points.position.copy(cam);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

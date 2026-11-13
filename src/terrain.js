import * as THREE from 'three';

// ---- Course definition -----------------------------------------------------
// The run heads toward -Z. `s` = distance down the course = -z.
export const FINISH = 3200;
export const CHUNK = 120;
export const HALF_W = 110;
const CELL = 2.5;
const NX = (HALF_W * 2) / CELL;
const NZ = CHUNK / CELL;

export const K0 = 160;
export const KSTEP = 170;
export const KLEN = 12.5;
const KHALF = 5;

const fract = (v) => v - Math.floor(v);
export const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const centerX = (s) => 38 * Math.sin(s / 260) + 16 * Math.sin(s / 97 + 1.3);
const baseH = (s) => -(0.27 * s + 14 * Math.sin(s / 180));

export function kicker(k) {
  const s0 = K0 + k * KSTEP;
  return {
    s0,
    x0: centerX(s0) + (hash(k) - 0.5) * 16,
    hgt: 2.3 + hash(k + 50) * 1.5,
    valid: k >= 0 && s0 < FINISH - 200,
  };
}

export function gate(k) {
  const s = K0 + 85 + k * KSTEP;
  return { s, x: centerX(s) + (hash(k + 100) - 0.5) * 22, valid: k >= 0 && s < FINISH - 60 };
}

const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Kicker bump. `mode`: 0 = real surface, 1 = extend ramp past the lip (for
// normals while standing on the ramp), 2 = ignore kickers.
function kickerH(x, s, mode, kIdx) {
  if (mode === 2) return 0;
  const K = kicker(mode === 1 ? kIdx : Math.floor((s - K0) / KSTEP));
  if (!K.valid) return 0;
  const u = s - K.s0;
  if (u < 0 || (mode === 0 && u > KLEN)) return 0;
  const t = u / KLEN;
  return K.hgt * t * t * (1 - smooth(KHALF - 1.8, KHALF, Math.abs(x - K.x0)));
}

function onRamp(x, s) {
  const K = kicker(Math.floor((s - K0) / KSTEP));
  const u = s - K.s0;
  return K.valid && u >= 0 && u <= KLEN && Math.abs(x - K.x0) < KHALF;
}

function ground(x, s) {
  const d = Math.abs(x - centerX(s));
  const rough = 1 + Math.max(0, d - 18) * 0.06;
  let h = baseH(s);
  h += 0.55 * Math.sin(x * 0.11 + s * 0.07) * Math.sin(s * 0.05 + x * 0.03) * rough;
  h += 0.16 * Math.sin(x * 0.35 + 1.7) * Math.sin(s * 0.23) * rough;
  if (d > 26) h += (d - 26) * (d - 26) * 0.009;
  return h;
}

export function heightAt(x, z) {
  return ground(x, -z) + kickerH(x, -z, 0);
}

export function normalAt(x, z, out) {
  const s = -z, e = 0.4;
  const mode = onRamp(x, s) ? 1 : 2;
  const kIdx = Math.floor((s - K0) / KSTEP);
  const h = (xx, ss) => ground(xx, ss) + kickerH(xx, ss, mode, kIdx);
  const dx = (h(x + e, s) - h(x - e, s)) / (2 * e);
  const ds = (h(x, s + e) - h(x, s - e)) / (2 * e);
  // z = -s  =>  dh/dz = -dh/ds
  return out.set(-dx, 1, ds).normalize();
}

// ---- Obstacles ---------------------------------------------------------------
function nearFeature(x, s) {
  const k = Math.round((s - K0) / KSTEP);
  for (let i = k - 1; i <= k + 1; i++) {
    const K = kicker(i);
    if (K.valid && s > K.s0 - 35 && s < K.s0 + 80 && Math.abs(x - K.x0) < 10) return true;
    const g = gate(i);
    if (g.valid && Math.abs(s - g.s) < 18 && Math.abs(x - g.x) < 8) return true;
  }
  return false;
}

function buildObstacles(ci) {
  const rnd = mulberry32(ci * 7919 + 13);
  const trees = [], rocks = [];
  const s0 = ci * CHUNK;
  for (let i = 0; i < 95; i++) {
    const s = s0 + rnd() * CHUNK;
    const u = (rnd() * 2 - 1) * (HALF_W - 4);
    const a = Math.abs(u), r = rnd(), sc = 0.8 + rnd() * 0.9;
    const x = centerX(s) + u;
    let ok;
    if (a > 24) ok = r < 0.9;
    else if (a > 15) ok = r < 0.35;
    else ok = s > 90 && s < FINISH - 30 && r < 0.05 + 0.1 * Math.min(1, s / FINISH) && !nearFeature(x, s);
    if (Math.abs(s - FINISH) < 8 && a < 26) ok = false;
    if (ok) trees.push({ x, z: -s, y: heightAt(x, -s), sc, rot: rnd() * 6.28 });
  }
  for (let i = 0; i < 5; i++) {
    const s = s0 + rnd() * CHUNK;
    const u = (rnd() * 2 - 1) * 20;
    const x = centerX(s) + u, r = rnd(), sc = 0.7 + rnd() * 0.8;
    if (s > 120 && s < FINISH - 30 && r < 0.3 + 0.4 * Math.min(1, s / FINISH) && !nearFeature(x, s))
      rocks.push({ x, z: -s, y: heightAt(x, -s), sc, rot: rnd() * 6.28 });
  }
  return { trees, rocks };
}

// ---- Terrain chunks ----------------------------------------------------------
const _n = new THREE.Vector3();
const SNOW = new THREE.Color(0xf4f8ff), SHADE = new THREE.Color(0xd3e3f7);
const ROCK = new THREE.Color(0x77808f), LIP = new THREE.Color(0xff6a3d);
const _c = new THREE.Color();

class Chunk {
  constructor(material) {
    const g = new THREE.BufferGeometry();
    const count = (NX + 1) * (NZ + 1);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const idx = [];
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.ci = null;
  }

  build(ci) {
    this.ci = ci;
    const g = this.mesh.geometry;
    const P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array;
    let o = 0;
    for (let j = 0; j <= NZ; j++) {
      const s = ci * CHUNK + j * CELL;
      const cx = centerX(s);
      const K = kicker(Math.floor((s - K0) / KSTEP));
      for (let i = 0; i <= NX; i++, o += 3) {
        const u = -HALF_W + i * CELL;
        const x = cx + u, z = -s;
        const h = heightAt(x, z);
        P[o] = x; P[o + 1] = h; P[o + 2] = z;
        normalAt(x, z, _n);
        N[o] = _n.x; N[o + 1] = _n.y; N[o + 2] = _n.z;
        const t = 0.5 + 0.5 * Math.sin(x * 0.21 + s * 0.13) * Math.sin(s * 0.09 - x * 0.05);
        _c.copy(SNOW).lerp(SHADE, t * 0.45);
        if (_n.y < 0.8) _c.lerp(ROCK, Math.min(1, (0.8 - _n.y) * 5) * (0.4 + 0.6 * hash(i * 13 + j * 7 + ci)));
        const ku = s - K.s0;
        if (K.valid && ku > KLEN - 3 && ku <= KLEN && Math.abs(x - K.x0) < KHALF - 0.5) _c.lerp(LIP, 0.75);
        C[o] = _c.r; C[o + 1] = _c.g; C[o + 2] = _c.b;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    this.obstacles = buildObstacles(ci);
  }
}

function treeGeometry() {
  const parts = [];
  const tiers = [[1.9, 2.6, 1.0], [1.5, 2.3, 2.3], [1.05, 2.0, 3.5], [0.6, 1.5, 4.6]];
  const green = new THREE.Color(0x1d6b45), tip = new THREE.Color(0xeaf3ff);
  for (const [r, h, y] of tiers) {
    const c = new THREE.ConeGeometry(r, h, 7, 2);
    c.translate(0, y + h / 2, 0);
    const pos = c.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const rad = Math.hypot(pos.getX(i), pos.getZ(i)) / r;
      _c.copy(green).lerp(tip, rad > 0.75 ? 0.15 : rad < 0.2 ? 0.25 : 0.9 * (1 - rad));
      col.set([_c.r, _c.g, _c.b], i * 3);
    }
    c.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(c);
  }
  // merge
  let vc = 0, ic = 0;
  for (const p of parts) { vc += p.attributes.position.count; ic += p.index.count; }
  const g = new THREE.BufferGeometry();
  const P = new Float32Array(vc * 3), N = new Float32Array(vc * 3), C = new Float32Array(vc * 3), I = new Uint16Array(ic);
  let vo = 0, io = 0;
  for (const p of parts) {
    P.set(p.attributes.position.array, vo * 3);
    N.set(p.attributes.normal.array, vo * 3);
    C.set(p.attributes.color.array, vo * 3);
    for (let i = 0; i < p.index.count; i++) I[io + i] = p.index.array[i] + vo;
    vo += p.attributes.position.count; io += p.index.count;
  }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1));
  return g;
}

function flagGroup(color, w, h) {
  const g = new THREE.Group();
  const poleM = new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.6 });
  const banM = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 0.7 });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, h + 2, 8), poleM);
    p.position.set((sx * w) / 2, h / 2 - 1, 0);
    p.castShadow = true;
    g.add(p);
  }
  const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 0.22), banM);
  b.position.y = h * 0.89 - 0.0;
  g.add(b);
  return g;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    this.chunks = [];
    this.active = new Map();
    this.range = [NaN, NaN];

    const MAXT = 1400, MAXR = 80;
    this.foliage = new THREE.InstancedMesh(treeGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), MAXT);
    this.trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6).translate(0, 0.6, 0), new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 }), MAXT);
    this.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x6f7885, roughness: 0.95, flatShading: true }), MAXR);
    for (const m of [this.foliage, this.trunks, this.rocks]) {
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
      scene.add(m);
    }
    this.gates = [];
    for (let i = 0; i < 5; i++) {
      const g = flagGroup(0x19c8ff, 8, 4.2);
      g.visible = false; scene.add(g); this.gates.push(g);
    }
    this.finish = flagGroup(0xff3d6e, 44, 9);
    const fx = centerX(FINISH);
    this.finish.position.set(fx, heightAt(fx, -FINISH), -FINISH);
    scene.add(this.finish);
  }

  update(s) {
    const c0 = Math.floor(s / CHUNK) - 1, c1 = c0 + 7;
    if (c0 === this.range[0]) return;
    this.range = [c0, c1];
    for (const [ci, ch] of this.active)
      if (ci < c0 || ci > c1) { this.active.delete(ci); this.scene.remove(ch.mesh); this.chunks.push(ch); }
    for (let ci = c0; ci <= c1; ci++) {
      if (this.active.has(ci)) continue;
      const ch = this.chunks.pop() || new Chunk(this.material);
      ch.build(ci);
      this.scene.add(ch.mesh);
      this.active.set(ci, ch);
    }
    // instances
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let ti = 0, ri = 0;
    for (const ch of this.active.values()) {
      for (const t of ch.obstacles.trees) {
        if (ti >= this.foliage.instanceMatrix.count) break;
        q.setFromAxisAngle(up, t.rot); p.set(t.x, t.y - 0.3, t.z); sc.setScalar(t.sc);
        m.compose(p, q, sc);
        this.foliage.setMatrixAt(ti, m); this.trunks.setMatrixAt(ti, m); ti++;
      }
      for (const r of ch.obstacles.rocks) {
        if (ri >= this.rocks.instanceMatrix.count) break;
        q.setFromAxisAngle(up, r.rot); p.set(r.x, r.y + r.sc * 0.2, r.z); sc.set(r.sc * 1.2, r.sc * 0.8, r.sc);
        m.compose(p, q, sc);
        this.rocks.setMatrixAt(ri++, m);
      }
    }
    this.foliage.count = this.trunks.count = ti; this.rocks.count = ri;
    this.foliage.instanceMatrix.needsUpdate = this.trunks.instanceMatrix.needsUpdate = this.rocks.instanceMatrix.needsUpdate = true;
    // gates
    const gk = Math.floor((s - K0 - 85) / KSTEP);
    this.gates.forEach((g, i) => {
      const G = gate(gk + i);
      g.visible = G.valid;
      if (G.valid) g.position.set(G.x, heightAt(G.x, -G.s), -G.s);
    });
  }

  // Returns 'tree' | 'rock' | null
  collide(pos) {
    const ci = Math.floor(-pos.z / CHUNK);
    for (let c = ci - 1; c <= ci + 1; c++) {
      const ch = this.active.get(c);
      if (!ch) continue;
      for (const t of ch.obstacles.trees) {
        const dx = pos.x - t.x, dz = pos.z - t.z, r = 0.45 * t.sc + 0.35;
        if (dx * dx + dz * dz < r * r && pos.y < t.y + 5 * t.sc) return 'tree';
      }
      for (const k of ch.obstacles.rocks) {
        const dx = pos.x - k.x, dz = pos.z - k.z, r = k.sc * 0.95 + 0.3;
        if (dx * dx + dz * dz < r * r && pos.y < k.y + k.sc * 0.9) return 'rock';
      }
    }
    return null;
  }
}

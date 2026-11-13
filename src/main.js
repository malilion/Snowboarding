import * as THREE from 'three';
import { World, heightAt, normalAt, centerX, gate, FINISH, K0, KSTEP } from './terrain.js';
import { createRider } from './rider.js';
import { Spray, Trail, Snowfall } from './effects.js';
import { GameAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const V = () => new THREE.Vector3();
const G = 12.5;
const HORIZON = new THREE.Color(0xdcebfa);

// ---- Renderer / scene ------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
scene.background = HORIZON;
scene.fog = new THREE.Fog(HORIZON, 140, 640);
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 5000);

const hemi = new THREE.HemisphereLight(0xc4dcff, 0xf2f6ff, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(70, 110, 45);

// sky dome
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(4000, 24, 12),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f76d2) }, hor: { value: HORIZON }, sunDir: { value: SUN_OFF.clone().normalize() } },
    vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; varying vec3 d;
      void main(){ vec3 n = normalize(d); float h = clamp(n.y*1.6+0.08,0.0,1.0);
        vec3 c = mix(hor, top, pow(h,0.65));
        float s = max(dot(n, sunDir),0.0);
        c += vec3(1.0,0.92,0.75)*(pow(s,350.0)*3.0 + pow(s,12.0)*0.22);
        gl_FragColor = vec4(c,1.0); }`,
  })
);
scene.add(sky);

// distant peaks
const peaks = new THREE.Group();
{
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
  const snowC = new THREE.Color(0xf3f8ff), baseC = new THREE.Color(0xa9c0dd);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + Math.sin(i * 9.1) * 0.15;
    const r = 520 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 420, h = 380 + (Math.sin(i * 78.233) * 0.5 + 0.5) * 420;
    const g = new THREE.ConeGeometry(r, h, 7, 5);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k) / h + 0.5;
      if (y < 0.98) { pos.setX(k, pos.getX(k) * (1 + Math.sin(k * 3.7 + i) * 0.22)); pos.setZ(k, pos.getZ(k) * (1 + Math.cos(k * 5.3 + i) * 0.22)); }
      c.copy(baseC).lerp(snowC, Math.min(1, Math.max(0, y * 1.5 - 0.1)));
      col.set([c.r, c.g, c.b], k * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    const dist = 1500 + (Math.sin(i * 4.1) * 0.5 + 0.5) * 500;
    m.position.set(Math.sin(a) * dist, h / 2 - 330, Math.cos(a) * dist);
    peaks.add(m);
  }
}
scene.add(peaks);

const world = new World(scene);
const rider = createRider();
scene.add(rider.group);
const spray = new Spray(scene);
const trail = new Trail(scene);
const snowfall = new Snowfall(scene);
const audio = new GameAudio();
rider.loadModel(import.meta.env.BASE_URL + 'models/rider.glb');

// ---- Input -----------------------------------------------------------------------
const keys = new Set();
const ALIAS = { KeyA: 'ArrowLeft', KeyD: 'ArrowRight', KeyW: 'ArrowUp', KeyS: 'ArrowDown', ShiftRight: 'ShiftLeft', KeyE: 'ShiftLeft' };
addEventListener('keydown', (e) => {
  const k = ALIAS[e.code] || e.code;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (k === 'Enter' && state !== 'run') startRun();
  if (k === 'KeyR') startRun();
  if (k === 'KeyP' && (state === 'run' || state === 'pause')) togglePause();
  if (k === 'KeyM') audio.setMuted(!audio.muted);
});
addEventListener('keyup', (e) => keys.delete(ALIAS[e.code] || e.code));
addEventListener('blur', () => keys.clear());
document.querySelectorAll('#touch button').forEach((b) => {
  const k = b.dataset.k;
  const on = (e) => { e.preventDefault(); keys.add(k); b.classList.add('on'); };
  const off = (e) => { e.preventDefault(); keys.delete(k); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});
const isTouch = matchMedia('(pointer: coarse)').matches;
$('start').addEventListener('click', startRun);
$('again').addEventListener('click', startRun);

// ---- Game state ------------------------------------------------------------------
let state = 'menu'; // menu | run | pause | finished
const P = {
  p: V(), v: V(), yaw: 0, grounded: true, steer: 0, charge: 0, wasJump: false,
  airTime: 0, spin: 0, flip: 0, spinV: 0, flipV: 0, grabT: 0, grabbing: false, takeoffSign: 1,
  crashT: 0, invuln: 0, crouch: 0, slip: 0, lean: 0,
};
const S = { score: 0, time: 0, chain: 0, chainT: 0, bestTrick: 0, bestTrickName: '—', nextGate: 0, finishT: 0, shake: 0 };
const BEST_KEY = 'powder-rush-best';
const getBest = () => { try { return +localStorage.getItem(BEST_KEY) || 0; } catch { return 0; } };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

function resetPlayer() {
  const x = centerX(8);
  P.p.set(x, heightAt(x, -8), -8);
  P.v.set(0, 0, 0);
  Object.assign(P, { yaw: 0, grounded: true, steer: 0, charge: 0, wasJump: false, airTime: 0, spin: 0, flip: 0, spinV: 0, flipV: 0, grabT: 0, crashT: 0, invuln: 0, crouch: 0, slip: 0, lean: 0 });
  Object.assign(S, { score: 0, time: 0, chain: 0, chainT: 0, bestTrick: 0, bestTrickName: '—', nextGate: 0, finishT: 0, shake: 0 });
  trail.reset();
  camDir.set(0, 0, -1);
  camPos.copy(P.p).add(_a.set(0, 4, 9));
  camLook.copy(P.p);
  qVis.identity();
}

function startRun() {
  audio.start();
  resetPlayer();
  P.v.set(0, 0, -4);
  state = 'run';
  $('menu').classList.add('hidden'); $('result').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (isTouch) $('touch').classList.remove('hidden');
  popup('GO!', '');
}
function togglePause() {
  state = state === 'pause' ? 'run' : 'pause';
  $('pause').classList.toggle('hidden', state !== 'pause');
}

let popT;
function popup(text, sub, bad = false) {
  const el = $('popup');
  el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  el.className = bad ? 'bad' : '';
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(popT);
}

// ---- Physics ---------------------------------------------------------------------
const _n = V(), _f = V(), _l = V(), _a = V(), _b = V();
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function takeoff(sign) {
  P.grounded = false; P.airTime = 0; P.spin = 0; P.flip = 0; P.grabT = 0; P.takeoffSign = sign || 1;
  trail.break();
}

function crash(msg = '摔倒！') {
  if (P.crashT > 0) return;
  P.crashT = 1.5; P.invuln = 2.6;
  P.v.multiplyScalar(0.35);
  S.chain = 0; S.score = Math.max(0, S.score - 150); S.shake = 0.6;
  popup(msg, '-150', true);
  audio.crash();
  spray.emit(P.p, _a.copy(P.v).multiplyScalar(0.3), 60, 6, 5);
}

function land() {
  P.grounded = true;
  const gh = heightAt(P.p.x, P.p.z);
  P.p.y = gh;
  normalAt(P.p.x, P.p.z, _n);
  const vn = P.v.dot(_n);
  P.v.addScaledVector(_n, -vn);
  const impact = Math.max(0, -vn);
  spray.emit(P.p, _a.copy(P.v).multiplyScalar(0.25), Math.min(50, 8 + impact * 3), 4, 3);
  if (P.airTime > 0.3) {
    audio.thump(Math.min(0.7, 0.2 + impact * 0.03));
    S.shake = Math.min(0.35, impact * 0.02);
    const flipErr = Math.abs(P.flip - Math.round(P.flip / (Math.PI * 2)) * Math.PI * 2);
    let d = wrapPi(P.yaw - Math.atan2(P.v.x, -P.v.z));
    if (Math.abs(d) > Math.PI / 2) d -= Math.sign(d) * Math.PI;
    if (P.crashT <= 0 && (flipErr > 0.95 || Math.abs(d) > 0.8)) crash(flipErr > 0.95 ? '落地失敗！' : '板子沒對正！');
    else if (P.crashT <= 0) { P.yaw -= d * 0.85; scoreTrick(); }
  }
  P.flip = 0; P.flipV = 0; P.spinV = 0; P.grabbing = false;
}

function scoreTrick() {
  const spins = Math.round(Math.abs(P.spin) / Math.PI);
  const flips = Math.round(Math.abs(P.flip) / (Math.PI * 2));
  const grab = P.grabT > 0.25;
  const parts = [];
  let pts = 0;
  if (flips) {
    const front = P.flip * P.takeoffSign > 0;
    parts.push(`${['', '', '兩周', '三周', '四周'][Math.min(flips, 4)]}${front ? '前' : '後'}空翻`);
    pts += flips * 450 * (1 + (flips - 1) * 0.3);
  }
  if (spins) { parts.push(`${spins * 180}° 轉體`); pts += spins * 120 * (1 + spins * 0.15); }
  if (grab) { parts.push('抓板'); pts += 80 + P.grabT * 220; }
  if (P.airTime > 0.9) pts += P.airTime * 45;
  if (!parts.length) {
    if (P.airTime > 1.1) { S.score += pts; popup('大跳躍', `+${fmt(pts)}`); }
    return;
  }
  const mult = [1, 1, 1.5, 2.2][parts.length] * (1 + 0.25 * S.chain);
  pts = Math.round((pts * mult) / 10) * 10;
  S.chain++; S.chainT = 7;
  S.score += pts;
  if (pts > S.bestTrick) { S.bestTrick = pts; S.bestTrickName = parts.join(' + '); }
  popup(parts.join(' + '), `+${fmt(pts)}${S.chain > 1 ? `　連段 ×${S.chain}` : ''}`);
  audio.trick(parts.length);
}

function step(dt) {
  const ctl = state === 'run' && P.crashT <= 0;
  const steerIn = ctl ? (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0) : 0;
  const up = ctl && keys.has('ArrowUp'), down = ctl && keys.has('ArrowDown');
  const jump = ctl && keys.has('Space');
  P.steer += (steerIn - P.steer) * Math.min(1, dt * 9);
  if (P.crashT > 0) P.crashT -= dt;
  if (P.invuln > 0) P.invuln -= dt;

  P.v.y -= G * dt;

  if (P.grounded) {
    normalAt(P.p.x, P.p.z, _n);
    const sp = P.v.length();
    P.yaw += P.steer * (2.4 / (1 + sp / 45)) * dt;
    _f.set(Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    _f.addScaledVector(_n, -_f.dot(_n)).normalize();
    _l.crossVectors(_n, _f);
    P.v.addScaledVector(_n, -P.v.dot(_n));
    let vf = P.v.dot(_f), vl = P.v.dot(_l);
    const slip = Math.abs(vl);
    vl *= Math.exp(-(P.crashT > 0 ? 2 : 8.5) * dt);
    const dir = Math.sign(vf) || 1;
    vf = dir * Math.sqrt(vf * vf + 0.7 * (slip * slip - vl * vl)); // carving keeps most of the energy
    const c = up ? 0.0021 : 0.0037;
    const dec = (0.035 * G * _n.y + c * vf * vf + (down ? 10 : 0) + (P.crashT > 0 ? 9 : 0) + (state === 'finished' ? 16 : 0)) * dt;
    vf = Math.abs(vf) <= dec ? 0 : vf - Math.sign(vf) * dec;
    if (up && Math.abs(vf) < 7) vf += dir * 5 * dt;
    P.v.copy(_f).multiplyScalar(vf).addScaledVector(_l, vl);
    P.slip = Math.min(1, slip / 6 + (down ? Math.min(1, sp / 12) : 0));

    // jump charge
    if (jump) P.charge = Math.min(1, P.charge + dt * 1.7);
    const release = !jump && P.wasJump && P.charge > 0;
    P.wasJump = jump;

    P.p.addScaledVector(P.v, dt);
    const gh = heightAt(P.p.x, P.p.z);
    if (release) {
      P.v.addScaledVector(_a.copy(_n).add(_b.set(0, 1, 0)).normalize(), 4.2 + 5 * P.charge);
      P.p.y = Math.max(P.p.y, gh) + 0.05;
      P.charge = 0;
      takeoff(dir);
      audio.jump();
    } else if (P.p.y > gh + 0.12) {
      P.charge = 0;
      takeoff(dir);
    } else P.p.y = gh;
    if (!jump) P.charge = 0;

    if (P.grounded) {
      // trail + spray
      trail.add(P.p, _l, _n, 0.1 + P.slip * 0.45);
      const amt = P.slip * sp * 0.25;
      if (amt > 0.2) spray.emit(P.p, _a.copy(_l).multiplyScalar(Math.sign(vl || P.steer) * 2.5).addScaledVector(P.v, 0.35), Math.min(6, Math.ceil(amt)), 2, 2 + sp * 0.06);
    }
  } else {
    P.airTime += dt;
    P.v.multiplyScalar(1 - Math.min(0.5, 0.003 * P.v.length() * dt));
    P.spinV += (steerIn * 6.6 - P.spinV) * Math.min(1, dt * 7);
    P.yaw += P.spinV * dt; P.spin += P.spinV * dt;
    const flipIn = (up ? 1 : 0) - (down ? 1 : 0);
    P.flipV += (flipIn * 6.4 - P.flipV) * Math.min(1, dt * 7);
    P.flip += P.flipV * dt;
    if (!flipIn) { // ease toward the nearest upright orientation
      const target = Math.round(P.flip / (Math.PI * 2)) * Math.PI * 2;
      P.flip += (target - P.flip) * Math.min(1, dt * 2.5);
    }
    P.grabbing = ctl && keys.has('ShiftLeft');
    if (P.grabbing) P.grabT += dt;
    P.slip = 0;
    P.p.addScaledVector(P.v, dt);
    if (P.p.y <= heightAt(P.p.x, P.p.z)) land();
  }

  // course bounds
  const s = -P.p.z, cx = centerX(s), u = P.p.x - cx;
  if (Math.abs(u) > 100) { P.p.x = cx + Math.sign(u) * 100; P.v.x *= -0.2; }

  if (state === 'run') {
    S.time += dt;
    if (S.chainT > 0 && (S.chainT -= dt) <= 0) S.chain = 0;
    // obstacles
    if (P.invuln <= 0 && P.crashT <= 0) {
      const hit = world.collide(P.p);
      if (hit) { crash(hit === 'tree' ? '撞樹了！' : '撞到岩石！'); P.v.x += (Math.random() - 0.5) * 6; }
    }
    // gates
    const g = gate(S.nextGate);
    if (g.valid && s >= g.s) {
      if (Math.abs(P.p.x - g.x) < 4.2 && P.p.y - heightAt(P.p.x, P.p.z) < 5) {
        S.score += 250;
        P.v.multiplyScalar(1 + 3.5 / Math.max(8, P.v.length()));
        popup('旗門！', '+250');
        audio.gate();
      }
      S.nextGate++;
    }
    while (gate(S.nextGate).valid && gate(S.nextGate).s < s - 1) S.nextGate++;
    if (s >= FINISH) finish();
  } else if (state === 'finished') {
    S.finishT += dt;
    if (S.finishT > 2.6 && $('result').classList.contains('hidden')) showResult();
  }
}

function finish() {
  state = 'finished';
  S.finishT = 0;
  audio.trick(3);
  popup('FINISH!', '');
}
function showResult() {
  const bonus = Math.max(0, Math.round((170 - S.time) * 30));
  const total = S.score + bonus, prev = getBest();
  $('rTrick').textContent = fmt(S.score);
  $('rTime').textContent = fmtTime(S.time);
  $('rBonus').textContent = `+${fmt(bonus)}`;
  $('rBestTrick').textContent = S.bestTrick ? `${S.bestTrickName}（${fmt(S.bestTrick)}）` : '—';
  $('rTotal').textContent = fmt(total);
  $('rBest').textContent = total > prev ? '新紀錄！' : `最高紀錄 ${fmt(prev)}`;
  if (total > prev) try { localStorage.setItem(BEST_KEY, total); } catch {}
  $('result').classList.remove('hidden');
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden');
}

// ---- Presentation ----------------------------------------------------------------
const qVis = new THREE.Quaternion(), qT = new THREE.Quaternion(), qF = new THREE.Quaternion();
const mB = new THREE.Matrix4(), X = new THREE.Vector3(1, 0, 0);
const camDir = new THREE.Vector3(0, 0, -1), camPos = V(), camLook = V();
let menuT = 0;

function present(dt) {
  // rider orientation
  if (P.grounded) {
    normalAt(P.p.x, P.p.z, _n);
    _f.set(Math.sin(P.yaw), 0, -Math.cos(P.yaw)).addScaledVector(_n, -_f.dot(_n)).normalize();
  } else {
    _n.set(0, 1, 0);
    _f.set(Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  }
  _l.crossVectors(_n, _f);
  qT.setFromRotationMatrix(mB.makeBasis(_l, _n, _f));
  const tumble = P.crashT > 0 ? Math.min(1, P.crashT / 1.5) : 0;
  const ang = P.flip + (tumble ? (1 - tumble) * Math.PI * 4 : 0);
  if (ang) qT.multiply(qF.setFromAxisAngle(X, ang));
  qVis.slerp(qT, Math.min(1, dt * (P.grounded ? 14 : 30)));
  rider.group.quaternion.copy(qVis);
  rider.group.position.copy(P.p);
  rider.group.visible = !(P.invuln > 0 && P.crashT <= 0 && Math.floor(P.invuln * 12) % 2 === 0);

  const sp = P.v.length();
  const pose = rider.pose;
  const tuck = state === 'run' && keys.has('ArrowUp') && P.grounded ? 0.55 : 0;
  const targetCrouch = Math.max(P.charge, tuck, P.grounded ? 0.12 : P.grabbing ? 0.8 : 0.35);
  pose.crouch += (targetCrouch - pose.crouch) * Math.min(1, dt * 12);
  P.lean += ((P.grounded ? P.steer * Math.min(0.55, 0.12 + sp * 0.014) : 0) - P.lean) * Math.min(1, dt * 8);
  pose.lean = P.lean;
  pose.grab += ((P.grabbing ? 1 : 0) - pose.grab) * Math.min(1, dt * 12);
  pose.tumble = tumble;
  pose.look = P.steer;
  rider.update();

  // camera
  if (state === 'menu') {
    menuT += dt;
    const a = menuT * 0.25 + 2.4;
    camPos.set(P.p.x + Math.sin(a) * 6.5, P.p.y + 2.2, P.p.z + Math.cos(a) * 6.5);
    camera.position.copy(camPos);
    camera.lookAt(P.p.x, P.p.y + 1, P.p.z);
    camera.fov = 50;
  } else {
    _a.set(P.v.x, 0, P.v.z);
    if (_a.lengthSq() > 9) camDir.lerp(_a.normalize(), Math.min(1, dt * 3.2)).normalize();
    const air = P.grounded ? 0 : Math.min(1, P.airTime);
    const dist = 5.4 + sp * 0.05 + air * 1.6, hgt = 2.3 + sp * 0.018 + air * 1.0;
    _b.copy(P.p).addScaledVector(camDir, -dist); _b.y += hgt;
    camPos.lerp(_b, Math.min(1, dt * 12));
    const floor = heightAt(camPos.x, camPos.z) + 1.3;
    if (camPos.y < floor) camPos.y = floor;
    camLook.lerp(_a.copy(P.p).addScaledVector(camDir, 7).setY(P.p.y + 1.1 - sp * 0.02), Math.min(1, dt * 12));
    camera.position.copy(camPos);
    if (S.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * S.shake; camera.position.y += (Math.random() - 0.5) * S.shake;
      S.shake *= Math.exp(-6 * dt);
    }
    camera.lookAt(camLook);
    camera.rotateZ(-P.steer * Math.min(0.07, sp * 0.002));
    camera.fov += (Math.min(92, 62 + sp * 0.62) - camera.fov) * Math.min(1, dt * 4);
  }
  camera.updateProjectionMatrix();

  // follow-the-player scenery
  sun.target.position.copy(P.p);
  sun.position.copy(P.p).add(SUN_OFF);
  sky.position.copy(camera.position);
  peaks.position.set(P.p.x, P.p.y, P.p.z);
  world.update(-P.p.z);
  spray.update(dt);
  snowfall.update(dt, camera.position);
  audio.update(state === 'run' || state === 'finished' ? sp : 0, P.slip, P.grounded);
}

let hudT = 0;
function hud(dt) {
  if ((hudT += dt) < 0.05) return;
  hudT = 0;
  $('score').textContent = fmt(S.score);
  $('time').textContent = fmtTime(S.time);
  $('combo').textContent = `×${Math.max(1, S.chain + (S.chain ? 0 : 0))}`;
  $('combo').style.opacity = S.chain > 1 ? 1 : 0.55;
  $('speed').textContent = Math.round(P.v.length() * 3.6);
  $('progress').style.width = `${Math.min(100, (-P.p.z / FINISH) * 100)}%`;
  $('charge').style.opacity = P.charge > 0.02 ? 1 : 0;
  $('charge').firstElementChild.style.width = `${P.charge * 100}%`;
  let live = '';
  if (!P.grounded && P.airTime > 0.35 && P.crashT <= 0) {
    const spins = Math.round(Math.abs(P.spin) / Math.PI), flips = Math.round(Math.abs(P.flip) / (Math.PI * 2));
    live = [flips ? `空翻 ×${flips}` : '', spins ? `${spins * 180}°` : '', P.grabT > 0.25 ? '抓板' : ''].filter(Boolean).join('　');
  }
  $('live').textContent = live;
}

// ---- Loop ------------------------------------------------------------------------
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
resetPlayer();
world.update(0);
{ const b = getBest(); if (b) $('best').textContent = `最高紀錄 ${fmt(b)}`; }

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  if (state === 'run' || state === 'finished') {
    const n = 2;
    for (let i = 0; i < n; i++) step(dt / n);
    hud(dt);
  }
  if (state !== 'pause') present(dt);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// debug / test hook
window.__game = { P, S, keys, step, present, startRun, get state() { return state; }, heightAt, K0, KSTEP, rider, renderer, scene, camera };

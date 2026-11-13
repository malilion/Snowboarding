import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Rider local space: +Z = board nose (travel direction), +Y = up, rider faces -X.
const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

function limb(mat, r) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 1, 4, 8), mat);
  m.castShadow = true;
  m.userData.r = r;
  return m;
}
function stretch(mesh, a, b) {
  _d.subVectors(b, a);
  const len = _d.length();
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.scale.set(1, Math.max(0.01, len), 1);
  mesh.quaternion.setFromUnitVectors(UP, _d.normalize());
}

// ---- Skeleton-driven posing for the rigged GLB ------------------------------------
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _aq = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _ax = new THREE.Vector3();

// Apply a world-space rotation delta to a bone.
function rotW(bone, delta) {
  bone.parent.getWorldQuaternion(_pq);
  bone.getWorldQuaternion(_bq);
  bone.quaternion.copy(_pq.invert()).multiply(delta).multiply(_bq);
}
function setWorldQuat(bone, q) {
  bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert()).multiply(q);
}
// Analytic two-bone IK: bend `low`, then swing `up` so `end` reaches world target t.
function ik2(up, low, end, t) {
  up.getWorldPosition(_a); low.getWorldPosition(_b); end.getWorldPosition(_c);
  const lab = _a.distanceTo(_b), lcb = _c.distanceTo(_b);
  const lat = Math.min(lab + lcb - 1e-3, Math.max(0.05, _a.distanceTo(t)));
  _v1.subVectors(_c, _b); _v2.subVectors(_a, _b);
  const cur = _v1.angleTo(_v2);
  const want = Math.acos(Math.min(1, Math.max(-1, (lab * lab + lcb * lcb - lat * lat) / (2 * lab * lcb))));
  _ax.crossVectors(_v1, _v2);
  if (_ax.lengthSq() > 1e-10) rotW(low, _q.setFromAxisAngle(_ax.normalize(), cur - want));
  end.getWorldPosition(_c);
  _v1.subVectors(_c, _a).normalize(); _v2.subVectors(t, _a).normalize();
  rotW(up, _q.setFromUnitVectors(_v1, _v2));
}

function setupRig(obj) {
  const B = {};
  obj.traverse((o) => { if (o.isBone) B[o.name] = o; });
  if (!B.Hips || !B.LeftUpLeg || !B.RightUpLeg || !B.Spine) return null;
  const arm = B.Hips.parent;
  obj.updateMatrixWorld(true);
  const bones = Object.values(B);
  const rest = bones.map((b) => ({ b, q: b.quaternion.clone(), p: b.position.clone() }));
  const inv = arm.matrixWorld.clone().invert();
  const armQ = arm.getWorldQuaternion(new THREE.Quaternion());
  const lp = (b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const lq = (b) => armQ.clone().invert().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
  const legs = [['LeftUpLeg', 'LeftLeg', 'LeftFoot'], ['RightUpLeg', 'RightLeg', 'RightFoot']].map(([u, l, e]) => ({ up: B[u], low: B[l], end: B[e], pos: lp(B[e]), q: lq(B[e]) }));
  // Armature-space axes: side = rider's left, fwd = where the chest faces, UP.
  const side = lp(B.LeftShoulder).sub(lp(B.RightShoulder)).setY(0).normalize();
  const fwd = new THREE.Vector3().crossVectors(side, UP).normalize();
  const mid = legs[0].pos.clone().add(legs[1].pos).multiplyScalar(0.5);
  const grabAt = mid.clone().addScaledVector(fwd, 0.26).addScaledVector(UP, -0.06);
  const W = new THREE.Vector3(), q = new THREE.Quaternion();
  // rotate bone about an armature-space axis
  const rotA = (bone, axis, ang) => {
    if (!bone || !ang) return;
    arm.getWorldQuaternion(_aq);
    rotW(bone, q.setFromAxisAngle(W.copy(axis).applyQuaternion(_aq).normalize(), ang));
  };
  let time = 0;

  function apply(pose, dt) {
    time += dt;
    for (const r of rest) { r.b.quaternion.copy(r.q); r.b.position.copy(r.p); }
    const c = pose.crouch - 0.12, g = pose.grab, air = pose.air, tum = pose.tumble;
    const wob = Math.sin(time * 7) * 0.5 + Math.sin(time * 11.3) * 0.5;

    // hips: sink / rise, shift over the toe or heel edge when carving
    B.Hips.position.y -= c * 0.2 + g * 0.05 - air * 0.03;
    B.Hips.position.addScaledVector(fwd, -pose.lean * 0.1 + c * 0.03);
    B.Hips.position.addScaledVector(side, pose.look * 0.03);

    // spine: fold forward when crouching, counter-balance the edge lean, twist into the turn
    const bend = c * 0.55 + g * 0.45 + pose.lean * 0.55 + tum * Math.sin(time * 17) * 0.4;
    rotA(B.Spine, side, bend * 0.45); rotA(B.Spine1, side, bend * 0.3); rotA(B.Spine2, side, bend * 0.25);
    const twist = pose.look * 0.32 + pose.spin * 0.45;
    rotA(B.Spine1, UP, twist * 0.5); rotA(B.Spine2, UP, twist * 0.5);
    rotA(B.Neck, side, -bend * 0.35); rotA(B.Head, UP, twist * 0.6);

    // arms: float up in the air, wind up with spins, flail when crashing
    const lift = air * 0.45 + tum * (0.9 + Math.sin(time * 23) * 0.5) + pose.speed * wob * 0.035 - c * 0.15;
    rotA(B.LeftArm, fwd, lift + pose.look * 0.18); rotA(B.RightArm, fwd, -lift + pose.look * 0.18);
    rotA(B.LeftArm, UP, twist * 0.6 + tum * Math.cos(time * 19) * 0.6); rotA(B.RightArm, UP, twist * 0.6);
    rotA(B.LeftForeArm, fwd, lift * 0.4); rotA(B.RightForeArm, fwd, -lift * 0.4);

    // legs: keep both boots locked to the board
    arm.updateWorldMatrix(true, false);
    arm.getWorldQuaternion(_aq);
    for (const L of legs) {
      ik2(L.up, L.low, L.end, _t.copy(L.pos).applyMatrix4(arm.matrixWorld));
      arm.getWorldQuaternion(_aq);
      setWorldQuat(L.end, _q.copy(_aq).multiply(L.q));
    }

    // grab: reach the trailing hand down to the toe edge
    if (g > 0.01 && B.RightHand) {
      B.RightHand.getWorldPosition(_v1);
      _t.copy(grabAt).applyMatrix4(arm.matrixWorld);
      _t.lerpVectors(_v1, _t, g);
      const tgt = _t.clone();
      ik2(B.RightArm, B.RightForeArm, B.RightHand, tgt);
    }
  }
  return { apply, bones: B };
}

export function createRider() {
  const group = new THREE.Group();
  const body = new THREE.Group(); // tilts (lean / tumble) around the board
  group.add(body);

  // --- procedural rider (fallback, also used until the GLB loads) ---
  const proc = new THREE.Group();
  body.add(proc);
  const jacket = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x14606b, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.5 });
  const boardM = new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.35, metalness: 0.1 });
  const visorM = new THREE.MeshStandardMaterial({ color: 0xffc23d, roughness: 0.15, metalness: 0.8 });

  const board = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.035, 1.25), boardM);
  board.add(deck);
  for (const sz of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.035, 16), boardM);
    tip.position.set(0, 0.02, sz * 0.66);
    tip.rotation.x = -sz * 0.22;
    board.add(tip);
    const bind = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.16), dark);
    bind.position.set(0, 0.06, sz * 0.27);
    board.add(bind);
  }
  board.traverse((o) => (o.castShadow = true));
  board.position.y = 0.03;
  proc.add(board);

  const legs = [limb(pants, 0.085), limb(pants, 0.085)];
  const shins = [limb(pants, 0.075), limb(pants, 0.075)];
  const arms = [limb(jacket, 0.065), limb(jacket, 0.065)];
  const fore = [limb(jacket, 0.058), limb(jacket, 0.058)];
  const torso = limb(jacket, 0.19);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), dark);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.153, 16, 8, 0, Math.PI, 1.05, 0.6), visorM);
  visor.rotation.y = Math.PI; // faces -X ... adjusted below
  head.add(visor);
  head.castShadow = true;
  const hands = [new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), dark), new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), dark)];
  proc.add(...legs, ...shins, ...arms, ...fore, torso, head, ...hands);
  visor.rotation.y = -Math.PI / 2 - Math.PI / 2;

  const hip = new THREE.Vector3(), chest = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), k = new THREE.Vector3();

  let model = null; // GLB replacement
  let rig = null;
  const pose = { crouch: 0, lean: 0, grab: 0, tumble: 0, look: 0, air: 0, spin: 0, speed: 0 };

  function poseProcedural() {
    const c = pose.crouch, g = pose.grab;
    const hipY = 0.82 - c * 0.3 - g * 0.12;
    hip.set(-0.04 - c * 0.08, hipY, 0);
    chest.set(-0.1 - c * 0.14 - g * 0.1, hipY + 0.46 - c * 0.05, 0.02);
    stretch(torso, a.copy(hip).setY(hip.y + 0.08), chest);
    head.position.set(chest.x - 0.03, chest.y + 0.27, 0.05 + pose.look * 0.03);
    head.rotation.y = -0.9 + pose.look * 0.3;
    for (let i = 0; i < 2; i++) {
      const sz = i ? 1 : -1;
      // legs: hip -> knee -> foot
      b.set(0, 0.12, sz * 0.27);
      a.set(hip.x, hip.y, sz * 0.11);
      k.addVectors(a, b).multiplyScalar(0.5);
      k.x -= 0.14 + c * 0.2; k.z += sz * 0.06;
      stretch(legs[i], a, k);
      stretch(shins[i], k, b);
      // arms: shoulder -> elbow -> hand
      a.set(chest.x, chest.y + 0.08, sz * 0.2);
      if (i === 1 && g > 0.01) b.set(-0.2, 0.12, 0.05).lerp(_d.set(chest.x - 0.05, hip.y - 0.1, 0.5), 1 - g);
      else b.set(chest.x - 0.1 - c * 0.1, hip.y + 0.12 + pose.tumble * 0.3, sz * (0.5 + pose.tumble * 0.15));
      k.addVectors(a, b).multiplyScalar(0.5);
      k.y -= 0.08; k.z += sz * 0.05;
      stretch(arms[i], a, k);
      stretch(fore[i], k, b);
      hands[i].position.copy(b);
    }
  }

  function update(dt = 0) {
    body.rotation.z = pose.lean;
    if (rig) {
      model.scale.setScalar(model.userData.base);
      rig.apply(pose, dt);
    } else if (model) {
      const sq = 1 - pose.crouch * 0.2 - pose.grab * 0.12;
      model.scale.set(1 + (1 - sq) * 0.35, sq, 1 + (1 - sq) * 0.35).multiplyScalar(model.userData.base);
      model.rotation.z = pose.grab * 0.25;
    } else poseProcedural();
  }
  update();

  function loadModel(url) {
    return new Promise((resolve) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          const obj = gltf.scene;
          const holder = new THREE.Group();
          let box = new THREE.Box3().setFromObject(obj);
          const size = box.getSize(new THREE.Vector3());
          // Board is the longest horizontal extent -> align it with Z.
          if (size.x > size.z) obj.rotation.y = Math.PI / 2;
          obj.updateMatrixWorld(true);
          box = new THREE.Box3().setFromObject(obj);
          const c = box.getCenter(new THREE.Vector3());
          obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
          holder.add(obj);
          holder.userData.base = 1.78 / (box.max.y - box.min.y);
          obj.traverse((o) => {
            if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
          });
          body.remove(proc);
          body.add(holder);
          model = holder;
          holder.scale.setScalar(holder.userData.base);
          group.updateMatrixWorld(true);
          rig = setupRig(obj);
          update();
          resolve(true);
        },
        undefined,
        () => resolve(false)
      );
    });
  }

  return { group, body, pose, update, loadModel, get model() { return model; }, get rig() { return rig; } };
}

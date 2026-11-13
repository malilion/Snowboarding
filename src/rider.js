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
  const pose = { crouch: 0, lean: 0, grab: 0, tumble: 0, look: 0 };

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

  function update() {
    body.rotation.z = pose.lean;
    if (model) {
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
          update();
          resolve(true);
        },
        undefined,
        () => resolve(false)
      );
    });
  }

  return { group, body, pose, update, loadModel, get model() { return model; } };
}

import * as THREE from 'three';

/** Shared, mutable journey state (written by the DOM, read inside the render loop). */
export const journey = {
  p: 0, // raw scroll progress 0..1
  smooth: 0, // eased progress used by the scene
  dusk: 0, // 0 = daytime, 1 = evening (drives lanterns, fireflies)
  speed: 0, // how fast the bike is moving right now
};

/** The winding village road, as [x, z] control points. */
const RAW = [
  [0, 8], [0, -6], [7, -22], [-3, -44], [9, -66], [1, -88], [-11, -110],
  [-2, -132], [10, -152], [13, -174], [2, -196], [-8, -216], [-4, -236], [0, -250],
];

export const curve = new THREE.CatmullRomCurve3(
  RAW.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  'centripetal',
);
export const curveLength = curve.getLength();
export const SAMPLES = curve.getSpacedPoints(500);

export const T_START = 0.03;
export const T_END = 0.97;
export const progressToT = (p) => T_START + (T_END - T_START) * THREE.MathUtils.clamp(p, 0, 1);

export function distToRoad(x, z, step = 1) {
  let m = Infinity;
  for (let i = 0; i < SAMPLES.length; i += step) {
    const dx = SAMPLES[i].x - x;
    const dz = SAMPLES[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < m) m = d;
  }
  return Math.sqrt(m);
}

/** Unit vector pointing to the right-hand side of the road at t. */
export function sideAt(t, target = new THREE.Vector3()) {
  const tan = curve.getTangentAt(t);
  return target.set(-tan.z, 0, tan.x).normalize();
}

const smooth = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Rolling-hill terrain that stays flat near the road and rises into hills far away. */
export function terrainHeight(x, z, d = distToRoad(x, z, 3)) {
  const rolling =
    Math.sin(x * 0.05) * Math.cos(z * 0.045) * 2.2 +
    Math.sin(x * 0.13 + z * 0.07) * 0.7 +
    Math.cos(z * 0.11 - x * 0.03) * 0.5;
  const hills = Math.max(0, d - 45) * 0.32 + Math.max(0, d - 80) * 0.25;
  return (rolling + 0.6) * smooth(5, 22, d) + hills;
}

/** Deterministic random generator so the village looks the same on every visit. */
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
/** Stretch a unit-height cylinder mesh so it spans from a to b. */
export function placeTube(mesh, a, b) {
  _dir.subVectors(b, a);
  const len = _dir.length() || 0.0001;
  mesh.position.copy(a).addScaledVector(_dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, _dir.divideScalar(len));
  mesh.scale.set(1, len, 1);
}

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { curve, curveLength, journey, placeTube, progressToT } from './path';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { theme } from '../config';

/*
 * A detailed city bike with a stylised rider, built from primitives.
 * Modelled facing +Z (forward), Y up. Colours come from the active theme
 * (src/config/themes.json → scene.bike).
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const WHEEL_R = 0.36;
const TYRE_TUBE = 0.042;
const TYRE_OUTER = WHEEL_R - 0.005 + TYRE_TUBE; // outermost point of the tyre
const ROAD_Y = 0.045; // height of the road surface (see ROAD in World.jsx)
/** Lift so the bottom of the tyres rests exactly on the road surface. */
const RIDE_HEIGHT = ROAD_Y + (TYRE_OUTER - WHEEL_R);
const CRANK_R = 0.17;
const THIGH = 0.47;
const SHIN = 0.47;

const P = {
  rearHub: V(0, WHEEL_R, -0.52),
  frontHub: V(0, WHEEL_R, 0.56),
  bb: V(0, 0.3, -0.04),
  seatTop: V(0, 0.84, -0.21),
  seatPostTop: V(0, 0.95, -0.25),
  headTop: V(0, 0.9, 0.4),
  headBottom: V(0, 0.72, 0.445),
  stemTop: V(0, 1.02, 0.39),
  hip: V(0, 1.06, -0.24),
  shoulder: V(0, 1.5, 0.06),
};
const GRIP_L = V(-0.27, 1.04, 0.27);
const GRIP_R = V(0.27, 1.04, 0.27);
const SHOULDER_L = V(-0.17, 1.49, 0.05);
const SHOULDER_R = V(0.17, 1.49, 0.05);
const ELBOW_L = V(-0.27, 1.27, 0.1);
const ELBOW_R = V(0.27, 1.27, 0.1);

const B = theme.scene.bike;
const C = {
  frame: B.frame,
  accent: B.scarf,
  tyre: '#16171f',
  rim: '#e4e7f2',
  metal: '#c9cddb',
  dark: '#23252f',
  saddle: '#1c1d24',
  jacket: B.shirt,
  pants: B.pants,
  helmet: B.helmet,
  basket: B.basket,
  skin: '#f0c08e',
  hair: '#2a1d16',
  shoe: '#f5f6fa',
  sole: '#2b2d38',
  glasses: '#10121a',
};

const lerp3 = (a, b, t) => a.clone().lerp(b, t);

/* ---------------- building blocks ---------------- */

function Tube({ a, b, r = 0.024, material, color }) {
  const ref = useRef();
  useLayoutEffect(() => placeTube(ref.current, a, b), [a, b]);
  return (
    <mesh ref={ref} castShadow material={material}>
      <cylinderGeometry args={[r, r, 1, 12]} />
      {!material && <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />}
    </mesh>
  );
}

/** A small sphere that hides the seam where tubes meet. */
const Joint = ({ at, r = 0.03, material }) => (
  <mesh position={at} material={material}>
    <sphereGeometry args={[r, 14, 10]} />
  </mesh>
);

function Wheel({ position, spinRef }) {
  const spokes = useMemo(() => Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2), []);
  return (
    <group position={position}>
      <group ref={spinRef}>
        {/* tyre */}
        <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[WHEEL_R - 0.005, TYRE_TUBE, 14, 48]} />
          <meshStandardMaterial color={C.tyre} roughness={0.95} />
        </mesh>
        {/* polished rim with a coloured pinstripe */}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[WHEEL_R - 0.05, 0.016, 8, 48]} />
          <meshStandardMaterial color={C.rim} metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[WHEEL_R - 0.068, 0.006, 6, 48]} />
          <meshStandardMaterial color={C.accent} emissive={C.accent} emissiveIntensity={0.35} />
        </mesh>
        {/* spokes, alternating sides like a real wheel */}
        {spokes.map((a, i) => (
          <mesh key={a} rotation={[a, 0, 0]} position={[i % 2 ? 0.012 : -0.012, 0, 0]}>
            <cylinderGeometry args={[0.0035, 0.0035, (WHEEL_R - 0.06) * 2, 4]} />
            <meshStandardMaterial color={C.metal} metalness={0.9} roughness={0.2} />
          </mesh>
        ))}
        {/* hub */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.11, 16]} />
          <meshStandardMaterial color={C.metal} metalness={0.8} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

/** Mudguard arc over a wheel. `from`/`arc` are angles (radians) measured from straight back. */
function Fender({ hub, from, arc, material }) {
  return (
    <group position={hub} rotation={[from, 0, 0]}>
      <mesh rotation={[0, Math.PI / 2, 0]} material={material} castShadow>
        <torusGeometry args={[WHEEL_R + 0.06, 0.018, 6, 32, arc]} />
      </mesh>
    </group>
  );
}

const _n = new THREE.Vector3();
const _perp = new THREE.Vector3();
/** Two-bone IK: find the knee so the foot lands on the pedal. */
function solveKnee(hip, foot, out) {
  _n.subVectors(foot, hip);
  const d = THREE.MathUtils.clamp(_n.length(), 0.1, THIGH + SHIN - 0.001);
  _n.normalize();
  const a = (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, THIGH * THIGH - a * a));
  _perp.set(0, _n.z, -_n.y).normalize(); // knees bend forward
  return out.copy(hip).addScaledVector(_n, a).addScaledVector(_perp, h);
}

/** Position + orient (no stretching) an object so its local Y axis points from a to b. */
const UP = V(0, 1, 0);
function alignBetween(obj, a, b) {
  const dir = b.clone().sub(a);
  obj.position.copy(a).addScaledVector(dir, 0.5);
  obj.quaternion.setFromUnitVectors(UP, dir.normalize());
}

/* ---------------- rider ---------------- */

/**
 * Rounded daypack worn on the rider's back. Built in the torso's local frame:
 * +Y runs up the spine, +Z points out of the chest, the back surface is at z ≈ -0.135.
 */
function Backpack({ reflectRef }) {
  const g = useMemo(() => {
    // Torso shape (must match the jacket capsule in <Torso>): radius, half-length, x/z scale.
    const R = 0.165;
    const H = 0.15;
    const SX = 1.12;
    const SZ = 0.82;
    const OFF = 0.014; // strap thickness: sits just on top of the fabric
    const radAt = (y) => (Math.abs(y) <= H ? R : Math.sqrt(Math.max(0, R * R - (Math.abs(y) - H) ** 2)));
    // Depth of the jacket surface at (x, y), measured from the spine.
    const depthAt = (x, y) => SZ * Math.sqrt(Math.max(0, radAt(y) ** 2 - (x / SX) ** 2));

    const strap = (s) => {
      const x = s * 0.095;
      const yTop = H + Math.sqrt(R * R - (0.095 / SX) ** 2); // top of the shoulder at this x
      const pts = [];
      // Up the back (starting inside the bag so there is no visible end)…
      for (const y of [0.15, 0.2, 0.24, 0.27]) pts.push(V(x, y, -(depthAt(x, y) + OFF)));
      // …over the shoulder…
      pts.push(V(x, yTop + OFF, 0));
      // …down the chest to the armpit…
      for (const y of [0.27, 0.24, 0.2, 0.14, 0.08, 0.04]) pts.push(V(x, y, depthAt(x, y) + OFF));
      // …then diagonally down and back under the arm into the bag's bottom corner.
      const wrap = [0.6, 0.95, 1.3, 1.65, 2.0, 2.35, 2.7];
      wrap.forEach((b, k) => {
        const y = 0.02 - (k / (wrap.length - 1)) * 0.18;
        pts.push(V(s * (SX * radAt(y) + OFF) * Math.sin(b), y, (SZ * radAt(y) + OFF) * Math.cos(b)));
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.012, 6, false);
    };
    // Chest strap: hugs the chest between the two shoulder straps.
    const chestY = 0.1;
    const chest = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        [-0.095, -0.05, 0, 0.05, 0.095].map((x) => V(x, chestY, depthAt(x, chestY) + OFF + 0.002)),
      ),
      24,
      0.008,
      6,
      false,
    );
    const buckleZ = depthAt(0, chestY) + OFF + 0.008;
    return {
      body: new RoundedBoxGeometry(0.3, 0.38, 0.14, 4, 0.05),
      pocket: new RoundedBoxGeometry(0.22, 0.15, 0.06, 3, 0.025),
      lid: new RoundedBoxGeometry(0.26, 0.07, 0.13, 3, 0.03),
      strapL: strap(-1),
      strapR: strap(1),
      chest,
      buckleZ,
      chestY,
    };
  }, []);
  const mats = useMemo(() => {
    const base = new THREE.Color(C.basket);
    return {
      body: new THREE.MeshStandardMaterial({ color: base, roughness: 0.75 }),
      pocket: new THREE.MeshStandardMaterial({ color: base.clone().lerp(new THREE.Color(C.dark), 0.3), roughness: 0.8 }),
      lid: new THREE.MeshStandardMaterial({ color: base.clone().lerp(new THREE.Color(C.dark), 0.15), roughness: 0.75 }),
      strap: new THREE.MeshStandardMaterial({ color: C.dark, roughness: 0.85 }),
      zip: new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.5 }),
      pull: new THREE.MeshStandardMaterial({ color: C.accent, roughness: 0.4, metalness: 0.3 }),
    };
  }, []);
  return (
    <group>
      <group position={[0, -0.01, -0.158]} rotation={[0.12, 0, 0]}>
        {/* main compartment + top lid */}
        <mesh geometry={g.body} material={mats.body} castShadow />
        <mesh geometry={g.lid} material={mats.lid} position={[0, 0.17, -0.008]} castShadow />
        {/* main zipper with two pulls */}
        <mesh position={[0, 0.125, -0.071]} material={mats.zip}>
          <boxGeometry args={[0.25, 0.009, 0.006]} />
        </mesh>
        {[-0.07, 0.08].map((x) => (
          <mesh key={x} position={[x, 0.108, -0.074]} material={mats.pull}>
            <boxGeometry args={[0.014, 0.03, 0.006]} />
          </mesh>
        ))}
        {/* front pocket with its own zipper */}
        <mesh geometry={g.pocket} material={mats.pocket} position={[0, -0.085, -0.078]} castShadow />
        <mesh position={[0, -0.02, -0.109]} material={mats.zip}>
          <boxGeometry args={[0.18, 0.008, 0.006]} />
        </mesh>
        <mesh position={[0.06, -0.035, -0.112]} material={mats.pull}>
          <boxGeometry args={[0.012, 0.026, 0.006]} />
        </mesh>
        {/* reflective strip that glows at night */}
        <mesh position={[0, 0.04, -0.072]}>
          <boxGeometry args={[0.2, 0.018, 0.004]} />
          <meshStandardMaterial ref={reflectRef} color="#f4f7ff" emissive="#dff6ff" emissiveIntensity={0.2} toneMapped={false} />
        </mesh>
        {/* grab handle */}
        <mesh position={[0, 0.205, 0]} material={mats.strap}>
          <torusGeometry args={[0.035, 0.008, 6, 16, Math.PI]} />
        </mesh>
        {/* side bottle pocket */}
        <group position={[0.165, -0.09, 0]}>
          <mesh material={mats.pocket}>
            <cylinderGeometry args={[0.038, 0.034, 0.13, 16]} />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.07, 14]} />
            <meshStandardMaterial color="#e9f6ff" roughness={0.2} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0.135, 0]} material={mats.pull}>
            <cylinderGeometry args={[0.02, 0.02, 0.025, 12]} />
          </mesh>
        </group>
      </group>
      {/* curved shoulder straps + chest strap with buckle */}
      <mesh geometry={g.strapL} material={mats.strap} />
      <mesh geometry={g.strapR} material={mats.strap} />
      <mesh geometry={g.chest} material={mats.strap} />
      <mesh position={[0, g.chestY, g.buckleZ]} material={mats.pull}>
        <boxGeometry args={[0.04, 0.028, 0.01]} />
      </mesh>
    </group>
  );
}

function Torso({ reflectRef }) {
  const ref = useRef();
  useLayoutEffect(() => alignBetween(ref.current, P.hip, P.shoulder), []);
  return (
    <group ref={ref}>
      {/* jacket */}
      <mesh scale={[1.12, 1, 0.82]} castShadow>
        <capsuleGeometry args={[0.165, 0.3, 8, 18]} />
        <meshStandardMaterial color={C.jacket} roughness={0.6} />
      </mesh>
      {/* zip + collar */}
      <mesh position={[0, 0.02, 0.137]}>
        <boxGeometry args={[0.018, 0.38, 0.01]} />
        <meshStandardMaterial color={C.dark} />
      </mesh>
      <mesh position={[0, 0.27, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.025, 8, 20]} />
        <meshStandardMaterial color={C.accent} roughness={0.5} />
      </mesh>
      <Backpack reflectRef={reflectRef} />
    </group>
  );
}

function Arm({ shoulder, elbow, grip, material }) {
  return (
    <>
      <Tube a={shoulder} b={elbow} r={0.05} material={material} />
      <Joint at={elbow} r={0.05} material={material} />
      <Tube a={elbow} b={grip} r={0.042} material={material} />
      {/* glove */}
      <mesh position={grip}>
        <sphereGeometry args={[0.045, 14, 10]} />
        <meshStandardMaterial color={C.dark} roughness={0.7} />
      </mesh>
      <Joint at={shoulder} r={0.06} material={material} />
    </>
  );
}

function Head({ headRef }) {
  return (
    <group ref={headRef} position={[0, 1.71, 0.15]}>
      {/* neck */}
      <mesh position={[0, -0.12, -0.02]}>
        <cylinderGeometry args={[0.05, 0.055, 0.12, 12]} />
        <meshStandardMaterial color={C.skin} roughness={0.7} />
      </mesh>
      {/* face */}
      <mesh castShadow>
        <sphereGeometry args={[0.12, 24, 18]} />
        <meshStandardMaterial color={C.skin} roughness={0.65} />
      </mesh>
      {/* nose */}
      <mesh position={[0, -0.01, 0.12]}>
        <sphereGeometry args={[0.022, 10, 8]} />
        <meshStandardMaterial color={C.skin} roughness={0.65} />
      </mesh>
      {/* hair at the back */}
      <mesh position={[0, 0, -0.025]} scale={[1.02, 1, 1]}>
        <sphereGeometry args={[0.125, 20, 14, Math.PI * 0.62, Math.PI * 1.76, Math.PI * 0.3, Math.PI * 0.45]} />
        <meshStandardMaterial color={C.hair} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* sunglasses */}
      <mesh position={[0, 0.02, 0.105]}>
        <boxGeometry args={[0.2, 0.04, 0.03]} />
        <meshStandardMaterial color={C.glasses} metalness={0.6} roughness={0.15} />
      </mesh>
      {/* aero helmet: shell, vents, visor and trim */}
      <group position={[0, 0.055, -0.01]}>
        <mesh scale={[1, 0.82, 1.22]} castShadow>
          <sphereGeometry args={[0.145, 26, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={C.helmet} roughness={0.3} metalness={0.15} />
        </mesh>
        {[-0.05, 0, 0.05].map((x) => (
          <mesh key={x} position={[x, 0.105, 0]}>
            <boxGeometry args={[0.018, 0.02, 0.2]} />
            <meshStandardMaterial color={C.dark} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.165]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.2, 0.012, 0.06]} />
          <meshStandardMaterial color={C.accent} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.002, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.22, 1]}>
          <torusGeometry args={[0.143, 0.008, 6, 32]} />
          <meshStandardMaterial color={C.accent} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function Shoe({ shoeRef }) {
  return (
    <group ref={shoeRef}>
      <mesh position={[0, 0.03, 0.03]} castShadow>
        <boxGeometry args={[0.1, 0.07, 0.22]} />
        <meshStandardMaterial color={C.shoe} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.008, 0.03]}>
        <boxGeometry args={[0.106, 0.018, 0.226]} />
        <meshStandardMaterial color={C.sole} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.067, 0.07]}>
        <boxGeometry args={[0.08, 0.008, 0.08]} />
        <meshStandardMaterial color={C.accent} />
      </mesh>
    </group>
  );
}

/** Soft dark blob under each tyre so the wheels read as touching the road. */
function ContactShadows() {
  const tex = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }, []);
  const y = ROAD_Y - RIDE_HEIGHT + 0.004; // just above the road surface, in bike space
  return [P.rearHub.z, P.frontHub.z].map((z) => (
    <mesh key={z} position={[0, y, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[0.16, 0.42]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  ));
}

/* ---------------- bike + rider ---------------- */

export default function Bicycle() {
  const root = useRef();
  const lean = useRef();
  const body = useRef();
  const head = useRef();
  const rearSpin = useRef();
  const frontSpin = useRef();
  const crank = useRef();
  const frontLight = useRef();
  const rearLight = useRef();
  const reflectRef = useRef();
  const legs = {
    lThigh: useRef(), lShin: useRef(), rThigh: useRef(), rShin: useRef(),
    lCrank: useRef(), rCrank: useRef(), lPedal: useRef(), rPedal: useRef(),
    lKnee: useRef(), rKnee: useRef(), lShoe: useRef(), rShoe: useRef(),
  };

  const mats = useMemo(
    () => ({
      paint: new THREE.MeshStandardMaterial({ color: C.frame, roughness: 0.32, metalness: 0.35 }),
      accent: new THREE.MeshStandardMaterial({ color: C.accent, roughness: 0.32, metalness: 0.35 }),
      fender: new THREE.MeshStandardMaterial({ color: C.rim, roughness: 0.35, metalness: 0.5 }),
      pants: new THREE.MeshStandardMaterial({ color: C.pants, roughness: 0.75 }),
      jacket: new THREE.MeshStandardMaterial({ color: C.jacket, roughness: 0.6 }),
    }),
    [],
  );

  const state = useMemo(
    () => ({
      pos: new THREE.Vector3(), tan: new THREE.Vector3(), ahead: new THREE.Vector3(),
      look: new THREE.Vector3(), lean: 0, lastDist: 0,
      hipL: V(-0.1, P.hip.y, P.hip.z), hipR: V(0.1, P.hip.y, P.hip.z),
      pedalL: new THREE.Vector3(), pedalR: new THREE.Vector3(),
      ankle: new THREE.Vector3(),
      bbL: V(-0.085, P.bb.y, P.bb.z), bbR: V(0.085, P.bb.y, P.bb.z),
      knee: new THREE.Vector3(),
    }),
    [],
  );

  // Static frame geometry (computed once).
  const G = useMemo(() => {
    const stays = (x) => ({
      chain: [V(x, P.rearHub.y, P.rearHub.z), V(x * 0.6, P.bb.y + 0.01, P.bb.z - 0.03)],
      seat: [V(x, P.rearHub.y, P.rearHub.z), V(x * 0.4, P.seatTop.y - 0.04, P.seatTop.z - 0.03)],
      fork: [V(x, P.frontHub.y, P.frontHub.z), V(x * 0.5, P.headBottom.y, P.headBottom.z)],
    });
    return {
      L: stays(-0.055),
      R: stays(0.055),
      bottleA: lerp3(P.bb, P.headBottom, 0.28).add(V(0, 0.065, -0.01)),
      bottleB: lerp3(P.bb, P.headBottom, 0.6).add(V(0, 0.065, -0.01)),
      barMidL: V(-0.16, 1.045, 0.36),
      barMidR: V(0.16, 1.045, 0.36),
      gripInL: V(-0.2, 1.04, 0.3),
      gripInR: V(0.2, 1.04, 0.3),
      chainTopA: V(0.06, P.bb.y + 0.1, P.bb.z),
      chainTopB: V(0.06, P.rearHub.y + 0.045, P.rearHub.z),
      chainBotA: V(0.06, P.bb.y - 0.1, P.bb.z),
      chainBotB: V(0.06, P.rearHub.y - 0.045, P.rearHub.z),
      rackA: V(0, 0.82, -0.3),
      rackB: V(0, 0.82, -0.7),
      rackBarL: V(-0.08, 0.82, -0.68),
      rackBarR: V(0.08, 0.82, -0.68),
      rackStrut: V(0, 0.82, -0.68),
    };
  }, []);

  useFrame(({ clock }, dt) => {
    const s = state;
    const t = progressToT(journey.smooth);
    curve.getPointAt(t, s.pos);
    curve.getTangentAt(t, s.tan);
    root.current.position.copy(s.pos);
    root.current.position.y += RIDE_HEIGHT;
    root.current.lookAt(s.look.copy(root.current.position).add(s.tan));

    // Lean into curves.
    curve.getTangentAt(Math.min(1, t + 0.012), s.ahead);
    const turn = s.tan.x * s.ahead.z - s.tan.z * s.ahead.x;
    const targetLean = THREE.MathUtils.clamp(turn * 3, -0.14, 0.14);
    s.lean += (targetLean - s.lean) * Math.min(1, dt * 4);
    lean.current.rotation.z = s.lean;

    // Wheels and pedals turn with distance travelled.
    const dist = t * curveLength;
    journey.speed = Math.abs(dist - s.lastDist) / Math.max(dt, 1e-3);
    s.lastDist = dist;
    const wheelAngle = dist / WHEEL_R;
    rearSpin.current.rotation.x = wheelAngle;
    frontSpin.current.rotation.x = wheelAngle;
    const theta = wheelAngle * 0.45;
    crank.current.rotation.x = theta;

    const cy = -Math.cos(theta) * CRANK_R;
    const cz = -Math.sin(theta) * CRANK_R;
    s.pedalR.set(0.13, P.bb.y + cy, P.bb.z + cz);
    s.pedalL.set(-0.13, P.bb.y - cy, P.bb.z - cz);
    placeTube(legs.rCrank.current, s.bbR, s.pedalR);
    placeTube(legs.lCrank.current, s.bbL, s.pedalL);
    legs.rPedal.current.position.copy(s.pedalR);
    legs.lPedal.current.position.copy(s.pedalL);

    // Gentle bob while pedalling, plus breathing when idle.
    const moving = Math.min(1, journey.speed * 0.15);
    const bob = Math.sin(theta * 2) * 0.012 * moving + Math.sin(clock.elapsedTime * 2) * 0.004;
    body.current.position.y = bob;
    s.hipL.y = s.hipR.y = P.hip.y + bob;

    // Head glances around now and then.
    head.current.rotation.y = Math.sin(clock.elapsedTime * 0.45) * 0.22;
    head.current.rotation.x = 0.08 + Math.sin(clock.elapsedTime * 0.7) * 0.03;

    // Legs: hip → knee → ankle, feet planted on the pedals.
    for (const side of ['r', 'l']) {
      const hip = side === 'r' ? s.hipR : s.hipL;
      const pedal = side === 'r' ? s.pedalR : s.pedalL;
      s.ankle.copy(pedal).add({ x: 0, y: 0.06, z: -0.02 });
      solveKnee(hip, s.ankle, s.knee);
      placeTube(legs[`${side}Thigh`].current, hip, s.knee);
      placeTube(legs[`${side}Shin`].current, s.knee, s.ankle);
      legs[`${side}Knee`].current.position.copy(s.knee);
      const shoe = legs[`${side}Shoe`].current;
      shoe.position.copy(pedal).add({ x: 0, y: 0.012, z: -0.01 });
      shoe.rotation.x = -0.15 + Math.sin(theta + (side === 'r' ? 0 : Math.PI)) * 0.18;
    }

    // Lights brighten as evening falls.
    frontLight.current.emissiveIntensity = 0.6 + journey.dusk * 4;
    rearLight.current.emissiveIntensity = 0.5 + journey.dusk * 3;
    reflectRef.current.emissiveIntensity = 0.15 + journey.dusk * 2.5;
  });

  return (
    <group ref={root}>
      <ContactShadows />
      <group ref={lean}>
        {/* ---------- frame ---------- */}
        <Tube a={P.bb} b={P.seatTop} r={0.026} material={mats.paint} />
        <Tube a={P.seatTop} b={P.headTop} r={0.026} material={mats.paint} />
        <Tube a={P.bb} b={P.headBottom} r={0.033} material={mats.paint} />
        <Tube a={P.headBottom} b={P.headTop} r={0.034} material={mats.accent} />
        {['L', 'R'].map((k) => (
          <group key={k}>
            <Tube a={G[k].chain[0]} b={G[k].chain[1]} r={0.016} material={mats.paint} />
            <Tube a={G[k].seat[0]} b={G[k].seat[1]} r={0.014} material={mats.paint} />
            <Tube a={G[k].fork[0]} b={G[k].fork[1]} r={0.018} material={mats.paint} />
          </group>
        ))}
        <Joint at={P.bb} r={0.045} material={mats.paint} />
        <Joint at={P.seatTop} r={0.032} material={mats.paint} />
        {/* bottle on the down tube */}
        <Tube a={G.bottleA} b={G.bottleB} r={0.034} material={mats.accent} />
        {/* seat post + saddle */}
        <Tube a={P.seatTop} b={P.seatPostTop} r={0.016} color={C.metal} />
        <mesh position={[0, 0.975, -0.26]} scale={[0.75, 0.32, 1.3]} castShadow>
          <sphereGeometry args={[0.11, 20, 12]} />
          <meshStandardMaterial color={C.saddle} roughness={0.55} />
        </mesh>
        {/* stem + swept-back handlebar with grips and bell */}
        <Tube a={P.headTop} b={P.stemTop} r={0.02} color={C.metal} />
        <Tube a={G.barMidL} b={G.barMidR} r={0.016} color={C.metal} />
        <Tube a={G.barMidL} b={G.gripInL} r={0.016} color={C.metal} />
        <Tube a={G.barMidR} b={G.gripInR} r={0.016} color={C.metal} />
        <Tube a={G.gripInL} b={GRIP_L} r={0.024} color={C.dark} />
        <Tube a={G.gripInR} b={GRIP_R} r={0.024} color={C.dark} />
        <mesh position={[0.11, 1.075, 0.36]}>
          <sphereGeometry args={[0.025, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={C.rim} metalness={0.9} roughness={0.2} />
        </mesh>
        {/* front lamp */}
        <group position={[0, 0.96, 0.47]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.045, 0.07, 16]} />
            <meshStandardMaterial color={C.dark} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.037]}>
            <circleGeometry args={[0.036, 20]} />
            <meshStandardMaterial ref={frontLight} color="#fffbe6" emissive="#fff3c4" emissiveIntensity={0.6} toneMapped={false} />
          </mesh>
        </group>
        {/* rear rack + tail light */}
        <Tube a={G.rackA} b={G.rackB} r={0.012} color={C.metal} />
        <Tube a={G.rackBarL} b={G.rackBarR} r={0.012} color={C.metal} />
        <Tube a={G.rackStrut} b={P.rearHub} r={0.01} color={C.metal} />
        <mesh position={[0, 0.8, -0.72]}>
          <boxGeometry args={[0.07, 0.035, 0.025]} />
          <meshStandardMaterial ref={rearLight} color="#ff3355" emissive="#ff1f4b" emissiveIntensity={0.5} toneMapped={false} />
        </mesh>
        {/* mudguards */}
        <Fender hub={P.rearHub} from={-0.12 * Math.PI} arc={0.62 * Math.PI} material={mats.fender} />
        <Fender hub={P.frontHub} from={0.42 * Math.PI} arc={0.55 * Math.PI} material={mats.fender} />
        {/* front basket with fruit */}
        <group position={[0, 0.9, 0.66]}>
          <mesh castShadow>
            <boxGeometry args={[0.34, 0.2, 0.26]} />
            <meshStandardMaterial color={C.basket} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.101, 0]}>
            <boxGeometry args={[0.36, 0.02, 0.28]} />
            <meshStandardMaterial color={C.dark} />
          </mesh>
          <mesh position={[0.06, 0.13, 0.02]}>
            <sphereGeometry args={[0.065, 14, 10]} />
            <meshStandardMaterial color="#ff5d5d" roughness={0.4} />
          </mesh>
          <mesh position={[-0.07, 0.12, -0.03]}>
            <sphereGeometry args={[0.055, 14, 10]} />
            <meshStandardMaterial color="#ffd166" roughness={0.4} />
          </mesh>
          <mesh position={[-0.02, 0.15, 0.06]} rotation={[0.3, 0, 0.4]}>
            <capsuleGeometry args={[0.02, 0.12, 4, 8]} />
            <meshStandardMaterial color="#7bd389" roughness={0.5} />
          </mesh>
        </group>

        <Wheel position={P.rearHub} spinRef={rearSpin} />
        <Wheel position={P.frontHub} spinRef={frontSpin} />

        {/* drivetrain: chainring, cog and chain */}
        <group position={P.bb} ref={crank}>
          <mesh rotation={[0, Math.PI / 2, 0]} position={[0.06, 0, 0]}>
            <torusGeometry args={[0.1, 0.014, 6, 28]} />
            <meshStandardMaterial color={C.metal} metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0.06, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.008, 20]} />
            <meshStandardMaterial color={C.dark} metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
        <mesh rotation={[0, Math.PI / 2, 0]} position={[0.06, P.rearHub.y, P.rearHub.z]}>
          <torusGeometry args={[0.045, 0.01, 6, 18]} />
          <meshStandardMaterial color={C.metal} metalness={0.85} roughness={0.25} />
        </mesh>
        <Tube a={G.chainTopA} b={G.chainTopB} r={0.007} color={C.dark} />
        <Tube a={G.chainBotA} b={G.chainBotB} r={0.007} color={C.dark} />

        {/* cranks + pedals (animated) */}
        <mesh ref={legs.rCrank}>
          <cylinderGeometry args={[0.014, 0.014, 1, 8]} />
          <meshStandardMaterial color={C.metal} metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh ref={legs.lCrank}>
          <cylinderGeometry args={[0.014, 0.014, 1, 8]} />
          <meshStandardMaterial color={C.metal} metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh ref={legs.rPedal}>
          <boxGeometry args={[0.1, 0.018, 0.07]} />
          <meshStandardMaterial color={C.dark} />
        </mesh>
        <mesh ref={legs.lPedal}>
          <boxGeometry args={[0.1, 0.018, 0.07]} />
          <meshStandardMaterial color={C.dark} />
        </mesh>

        {/* ---------- rider ---------- */}
        <mesh ref={legs.rThigh} material={mats.pants} castShadow>
          <cylinderGeometry args={[0.068, 0.058, 1, 14]} />
        </mesh>
        <mesh ref={legs.lThigh} material={mats.pants} castShadow>
          <cylinderGeometry args={[0.068, 0.058, 1, 14]} />
        </mesh>
        <mesh ref={legs.rShin} material={mats.pants} castShadow>
          <cylinderGeometry args={[0.055, 0.045, 1, 14]} />
        </mesh>
        <mesh ref={legs.lShin} material={mats.pants} castShadow>
          <cylinderGeometry args={[0.055, 0.045, 1, 14]} />
        </mesh>
        <mesh ref={legs.rKnee} material={mats.pants}>
          <sphereGeometry args={[0.06, 14, 10]} />
        </mesh>
        <mesh ref={legs.lKnee} material={mats.pants}>
          <sphereGeometry args={[0.06, 14, 10]} />
        </mesh>
        <Shoe shoeRef={legs.rShoe} />
        <Shoe shoeRef={legs.lShoe} />

        <group ref={body}>
          {/* hips */}
          <mesh position={P.hip} scale={[1.25, 0.8, 1.1]} material={mats.pants} castShadow>
            <sphereGeometry args={[0.13, 18, 12]} />
          </mesh>
          <Torso reflectRef={reflectRef} />
          <Arm shoulder={SHOULDER_L} elbow={ELBOW_L} grip={GRIP_L} material={mats.jacket} />
          <Arm shoulder={SHOULDER_R} elbow={ELBOW_R} grip={GRIP_R} material={mats.jacket} />
          <Head headRef={head} />
        </group>
      </group>
    </group>
  );
}

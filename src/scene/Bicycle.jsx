import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { curve, curveLength, journey, placeTube, progressToT } from './path';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const WHEEL_R = 0.36;
const CRANK_R = 0.17;
const THIGH = 0.47;
const SHIN = 0.47;

// Bike geometry, modelled facing +Z (forward) with Y up.
const P = {
  rearHub: V(0, WHEEL_R, -0.52),
  frontHub: V(0, WHEEL_R, 0.52),
  bb: V(0, 0.32, -0.04),
  seatTop: V(0, 0.86, -0.2),
  headTop: V(0, 0.92, 0.38),
  headBottom: V(0, 0.74, 0.42),
  stemTop: V(0, 1.02, 0.36),
  hip: V(0, 1.0, -0.2),
  shoulder: V(0, 1.47, 0.08),
};

const COLORS = {
  frame: '#7c5cff',
  tyre: '#1b1d2b',
  metal: '#d9dcec',
  shirt: '#ff5fa2',
  pants: '#2b2f45',
  skin: '#f1c27d',
  helmet: '#ffffff',
  basket: '#22d3ee',
}

function Tube({ a, b, r = 0.025, color = COLORS.frame }) {
  const ref = useRef();
  useLayoutEffect(() => placeTube(ref.current, a, b), [a, b]);
  return (
    <mesh ref={ref} castShadow>
      <cylinderGeometry args={[r, r, 1, 8]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
    </mesh>
  );
}

function Wheel({ position, spinRef }) {
  const spokes = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI), []);
  return (
    <group position={position}>
      <group ref={spinRef}>
        <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[WHEEL_R, 0.035, 10, 32]} />
          <meshStandardMaterial color={COLORS.tyre} roughness={0.9} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[WHEEL_R - 0.04, 0.012, 6, 32]} />
          <meshStandardMaterial color={COLORS.metal} metalness={0.7} roughness={0.3} />
        </mesh>
        {spokes.map((a) => (
          <mesh key={a} rotation={[a, 0, 0]}>
            <cylinderGeometry args={[0.006, 0.006, WHEEL_R * 2 - 0.06, 4]} />
            <meshStandardMaterial color={COLORS.metal} metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.1, 10]} />
          <meshStandardMaterial color={COLORS.metal} />
        </mesh>
      </group>
    </group>
  );
}

/** A limb whose ends are re-positioned every frame. */
function Limb({ limbRef, r, color }) {
  return (
    <mesh ref={limbRef} castShadow>
      <cylinderGeometry args={[r, r * 0.85, 1, 8]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
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
  _perp.set(0, _n.z, -_n.y).normalize(); // forward-pointing bend
  return out.copy(hip).addScaledVector(_n, a).addScaledVector(_perp, h);
}

export default function Bicycle() {
  const root = useRef();
  const lean = useRef();
  const body = useRef();
  const rearSpin = useRef();
  const frontSpin = useRef();
  const crank = useRef();
  const legs = {
    lThigh: useRef(), lShin: useRef(), rThigh: useRef(), rShin: useRef(),
    lCrank: useRef(), rCrank: useRef(), lPedal: useRef(), rPedal: useRef(),
  };
  const state = useMemo(
    () => ({
      pos: new THREE.Vector3(), tan: new THREE.Vector3(), ahead: new THREE.Vector3(),
      look: new THREE.Vector3(), lean: 0, lastDist: 0,
      hipL: V(-0.11, P.hip.y, P.hip.z), hipR: V(0.11, P.hip.y, P.hip.z),
      pedalL: new THREE.Vector3(), pedalR: new THREE.Vector3(),
      bbL: V(-0.09, P.bb.y, P.bb.z), bbR: V(0.09, P.bb.y, P.bb.z),
      knee: new THREE.Vector3(),
    }),
    [],
  );

  useFrame((_, dt) => {
    const s = state;
    const t = progressToT(journey.smooth);
    curve.getPointAt(t, s.pos);
    curve.getTangentAt(t, s.tan);
    root.current.position.copy(s.pos);
    root.current.lookAt(s.look.copy(s.pos).add(s.tan));

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

    // Gentle bob while pedalling.
    const bob = Math.sin(theta * 2) * 0.012;
    body.current.position.y = bob;
    s.hipL.y = s.hipR.y = P.hip.y + bob;

    solveKnee(s.hipR, s.pedalR, s.knee);
    placeTube(legs.rThigh.current, s.hipR, s.knee);
    placeTube(legs.rShin.current, s.knee, s.pedalR);
    solveKnee(s.hipL, s.pedalL, s.knee);
    placeTube(legs.lThigh.current, s.hipL, s.knee);
    placeTube(legs.lShin.current, s.knee, s.pedalL);
  });

  const gripL = V(-0.24, 1.02, 0.34);
  const gripR = V(0.24, 1.02, 0.34);
  const shoulderL = V(-0.17, P.shoulder.y, P.shoulder.z);
  const shoulderR = V(0.17, P.shoulder.y, P.shoulder.z);

  return (
    <group ref={root}>
      <group ref={lean}>
        {/* Frame */}
        <Tube a={P.rearHub} b={P.bb} />
        <Tube a={P.rearHub} b={P.seatTop} r={0.02} />
        <Tube a={P.bb} b={P.seatTop} />
        <Tube a={P.seatTop} b={P.headTop} />
        <Tube a={P.bb} b={P.headBottom} r={0.03} />
        <Tube a={P.headBottom} b={P.frontHub} r={0.022} color={COLORS.metal} />
        <Tube a={P.headTop} b={P.stemTop} r={0.022} color={COLORS.metal} />
        <Tube a={gripL} b={gripR} r={0.018} color={COLORS.metal} />
        <mesh position={[0, 0.9, -0.23]} castShadow>
          <boxGeometry args={[0.12, 0.05, 0.24]} />
          <meshStandardMaterial color="#3b2a20" />
        </mesh>
        {/* Front basket */}
        <mesh position={[0, 0.86, 0.62]} castShadow>
          <boxGeometry args={[0.32, 0.2, 0.24]} />
          <meshStandardMaterial color={COLORS.basket} roughness={1} />
        </mesh>
        <mesh position={[0.05, 0.99, 0.62]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color="#e74c3c" />
        </mesh>
        <mesh position={[-0.07, 0.98, 0.6]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color="#f1c40f" />
        </mesh>

        <Wheel position={P.rearHub} spinRef={rearSpin} />
        <Wheel position={P.frontHub} spinRef={frontSpin} />

        {/* Chainring */}
        <group position={P.bb} ref={crank}>
          <mesh rotation={[0, Math.PI / 2, 0]} position={[0.06, 0, 0]}>
            <torusGeometry args={[0.1, 0.015, 6, 20]} />
            <meshStandardMaterial color={COLORS.metal} metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
        <Limb limbRef={legs.rCrank} r={0.015} color={COLORS.metal} />
        <Limb limbRef={legs.lCrank} r={0.015} color={COLORS.metal} />
        <mesh ref={legs.rPedal}>
          <boxGeometry args={[0.1, 0.02, 0.07]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh ref={legs.lPedal}>
          <boxGeometry args={[0.1, 0.02, 0.07]} />
          <meshStandardMaterial color="#111" />
        </mesh>

        {/* Rider */}
        <Limb limbRef={legs.rThigh} r={0.065} color={COLORS.pants} />
        <Limb limbRef={legs.rShin} r={0.05} color={COLORS.pants} />
        <Limb limbRef={legs.lThigh} r={0.065} color={COLORS.pants} />
        <Limb limbRef={legs.lShin} r={0.05} color={COLORS.pants} />
        <group ref={body}>
          <Tube a={P.hip} b={P.shoulder} r={0.15} color={COLORS.shirt} />
          <Tube a={shoulderL} b={gripL} r={0.045} color={COLORS.shirt} />
          <Tube a={shoulderR} b={gripR} r={0.045} color={COLORS.shirt} />
          <mesh position={[0, 1.66, 0.16]} castShadow>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial color={COLORS.skin} />
          </mesh>
          <mesh position={[0, 1.72, 0.14]} castShadow>
            <sphereGeometry args={[0.145, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLORS.helmet} />
          </mesh>
          {/* Scarf trailing behind */}
          <mesh position={[0, 1.5, -0.08]} rotation={[0.9, 0, 0]} castShadow>
            <boxGeometry args={[0.08, 0.3, 0.02]} />
            <meshStandardMaterial color="#22d3ee" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

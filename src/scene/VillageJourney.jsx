import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Bicycle from './Bicycle';
import World from './World';
import { curve, journey, progressToT, sideAt } from './path';
import { theme } from '../config';

// Modern pastel day cycle: pink dawn → clear blue day → peach golden hour → violet neon night.
const SKY = theme.scene.sky;
const INSPECT = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('inspect') : null; // DEV-INSPECT

const cA = new THREE.Color();
const cB = new THREE.Color();
const out = {
  top: new THREE.Color(), horizon: new THREE.Color(), sun: new THREE.Color(),
  sunI: 0, hemi: 0, elev: 0,
};
function samplePalette(p) {
  let i = 0;
  while (i < SKY.length - 2 && p > SKY[i + 1].at) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const k = THREE.MathUtils.smoothstep(p, a.at, b.at);
  out.top.copy(cA.set(a.top)).lerp(cB.set(b.top), k);
  out.horizon.copy(cA.set(a.horizon)).lerp(cB.set(b.horizon), k);
  out.sun.copy(cA.set(a.sun)).lerp(cB.set(b.sun), k);
  out.sunI = THREE.MathUtils.lerp(a.sunI, b.sunI, k);
  out.hemi = THREE.MathUtils.lerp(a.hemi, b.hemi, k);
  out.elev = THREE.MathUtils.lerp(a.elev, b.elev, k);
  return out;
}

/**
 * Critically damped spring (Unity's SmoothDamp). `state.vel` carries velocity between frames,
 * `maxSpeed` caps how fast progress can change (units per second).
 */
function smoothDamp(current, target, state, smoothTime, dt, maxSpeed) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const maxChange = maxSpeed * smoothTime;
  const change = THREE.MathUtils.clamp(current - target, -maxChange, maxChange);
  const temp = (state.vel + omega * change) * dt;
  state.vel = (state.vel - omega * temp) * exp;
  let out = current - change + (change + temp) * exp;
  // Never overshoot the target.
  if (target - current > 0 === out > target) {
    out = target;
    state.vel = 0;
  }
  return out;
}

/** Big inverted sphere with a vertical gradient — a soft, modern sky. */
function SkyDome({ material }) {
  const ref = useRef();
  // Follows the camera so it never clips; drawn first and never writes depth, so it is always behind.
  useFrame(({ camera }) => ref.current.position.copy(camera.position));
  return (
    <mesh ref={ref} scale={300} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
}

function makeGlowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

export default function VillageJourney({ milestones, reducedMotion }) {
  const { camera, scene, size } = useThree();
  const hemi = useRef();
  const sunGlow = useRef();

  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight('#ffffff', 2);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera;
    c.left = c.bottom = -28;
    c.right = c.top = 28;
    c.near = 1;
    c.far = 120;
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 4;
    return l;
  }, []);

  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(SKY[0].top) },
          horizon: { value: new THREE.Color(SKY[0].horizon) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top;
          uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 col = mix(horizon, top, pow(h, 0.55));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  const glowTex = useMemo(makeGlowTexture, []);

  const tmp = useMemo(
    () => ({
      pos: new THREE.Vector3(), tan: new THREE.Vector3(), side: new THREE.Vector3(),
      desired: new THREE.Vector3(), look: new THREE.Vector3(), lookTarget: new THREE.Vector3(),
      sunDir: new THREE.Vector3(), init: false, vel: 0,
    }),
    [],
  );

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.1);
    // Spring the bike toward the scroll position: it accelerates away and coasts to a stop
    // like a real ride instead of snapping to each wheel notch.
    if (reducedMotion) {
      journey.smooth = journey.p;
      tmp.vel = 0;
    } else {
      journey.smooth = smoothDamp(journey.smooth, journey.p, tmp, 0.6, dt, 0.3);
    }
    journey.dusk = THREE.MathUtils.smoothstep(journey.smooth, 0.78, 1.0);

    const t = progressToT(journey.smooth);
    curve.getPointAt(t, tmp.pos);
    curve.getTangentAt(t, tmp.tan);
    sideAt(t, tmp.side);

    // Chase camera: behind, slightly to the side and above. Pulls back on narrow screens.
    const narrow = size.width < 700;
    const back = narrow ? 8.5 : 6.5;
    const lateral = narrow ? 2.2 : 3.4;
    const idleSway = Math.sin(state.clock.elapsedTime * 0.25) * 0.4;
    tmp.desired
      .copy(tmp.pos)
      .addScaledVector(tmp.tan, -back)
      .addScaledVector(tmp.side, lateral + idleSway)
      .add({ x: 0, y: narrow ? 3.6 : 3.0, z: 0 });
    // Pan so the rider sits on the opposite side of the screen from the text card:
    // cards are on the left at even stops and on the right at odd stops.
    const stops = milestones.length - 1;
    const cardSide = Math.cos(journey.smooth * stops * Math.PI); // +1 card left, -1 card right
    // The chase camera already sits to the right of the bike, so right-hand cards need less pan.
    const panAmount = cardSide > 0 ? (size.width < 1200 ? 3.2 : 2.4) : 0.6;
    const pan = narrow ? 0 : -panAmount * cardSide;
    tmp.lookTarget
      .copy(tmp.pos)
      .addScaledVector(tmp.tan, 4)
      .addScaledVector(tmp.side, pan)
      .add({ x: 0, y: 1.1, z: 0 });

    if (!tmp.init) {
      camera.position.copy(tmp.desired).add({ x: 6, y: 10, z: 12 }); // intro swoop
      tmp.look.copy(tmp.lookTarget);
      tmp.init = true;
    }
    const follow = 1 - Math.exp(-dt * 4.5);
    camera.position.lerp(tmp.desired, follow);
    tmp.look.lerp(tmp.lookTarget, follow);
    camera.lookAt(tmp.look);

    // DEV-INSPECT: ?inspect=back|side|front|top puts the camera right next to the rider.
    if (INSPECT) {
      const o = { back: [-1.6, 0.3, 1.7], side: [0.1, 2.0, 1.4], front: [1.8, 0.4, 1.6], top: [-0.6, 0.2, 2.6], left: [0.1, -2.0, 1.4] }[INSPECT] || [-1.6, 0.3, 1.7];
      camera.position.copy(tmp.pos).addScaledVector(tmp.tan, o[0]).addScaledVector(tmp.side, o[1]).add({ x: 0, y: o[2], z: 0 });
      camera.lookAt(tmp.pos.x, tmp.pos.y + 1.25, tmp.pos.z);
    }

    // Time of day.
    const pal = samplePalette(journey.smooth);
    skyMat.uniforms.top.value.copy(pal.top);
    skyMat.uniforms.horizon.value.copy(pal.horizon);
    scene.fog.color.copy(pal.horizon);
    sun.color.copy(pal.sun);
    sun.intensity = pal.sunI;
    hemi.current.intensity = pal.hemi;
    hemi.current.color.copy(pal.top).lerp(cA.set('#ffffff'), 0.55);

    const azimuth = -0.6 + journey.smooth * 1.4;
    tmp.sunDir.set(Math.sin(azimuth), pal.elev, -Math.cos(azimuth)).normalize();
    sun.position.copy(tmp.pos).addScaledVector(tmp.sunDir, 60);
    sun.target.position.copy(tmp.pos);
    sun.target.updateMatrixWorld();

    sunGlow.current.position.copy(camera.position).addScaledVector(tmp.sunDir, 200);
    sunGlow.current.material.color.copy(pal.sun);
  });

  return (
    <>
      <fog attach="fog" args={[SKY[0].horizon, 60, 200]} />
      <SkyDome material={skyMat} />
      <hemisphereLight ref={hemi} args={['#ffffff', theme.scene.hemiGround, 1]} />
      <primitive object={sun} />
      <primitive object={sun.target} />
      <sprite ref={sunGlow} scale={[60, 60, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} fog={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <World milestones={milestones} />
      <Bicycle />
    </>
  );
}

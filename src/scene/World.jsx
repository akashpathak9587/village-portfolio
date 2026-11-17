import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SAMPLES, curve, distToRoad, journey, progressToT, rng, sideAt, terrainHeight } from './path';
import { theme } from '../config';

/** Scene palette from the active theme (src/config/themes.json → scene). */
const S = theme.scene;

/* ------------------------------------------------------------------ */
/* Terrain + road                                                      */
/* ------------------------------------------------------------------ */

function Terrain() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(420, 420, 150, 150);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -120);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grassLow = new THREE.Color(S.grassLow);
    const grassHigh = new THREE.Color(S.grassHigh);
    const verge = new THREE.Color(S.verge);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = distToRoad(x, z, 3);
      const h = terrainHeight(x, z, d);
      pos.setY(i, h);
      c.copy(grassLow).lerp(grassHigh, THREE.MathUtils.clamp(h / 14, 0, 1));
      if (d < 4.5) c.lerp(verge, (1 - d / 4.5) * 0.8);
      c.offsetHSL(0, 0, (Math.sin(x * 0.35) * Math.cos(z * 0.3)) * 0.03);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

function Road() {
  const geometry = useMemo(() => {
    const width = 1.5;
    const verts = [];
    const uvs = [];
    const idx = [];
    const side = new THREE.Vector3();
    SAMPLES.forEach((p, i) => {
      const t = i / (SAMPLES.length - 1);
      sideAt(t, side);
      verts.push(p.x - side.x * width, 0.04, p.z - side.z * width);
      verts.push(p.x + side.x * width, 0.04, p.z + side.z * width);
      uvs.push(0, t * 60, 1, t * 60);
      if (i < SAMPLES.length - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);

  const texture = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = S.road;
    ctx.fillRect(0, 0, 64, 256);
    const r = rng(7);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(r() * 64, r() * 256, 1 + r() * 2, 1 + r() * 2);
    }
    ctx.fillStyle = S.roadEdge;
    ctx.fillRect(3, 0, 3, 256);
    ctx.fillRect(58, 0, 3, 256);
    ctx.fillStyle = S.roadDash;
    for (let y = 0; y < 256; y += 64) ctx.fillRect(30, y, 4, 34);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial map={texture} roughness={0.85} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Scatter: trees, houses, fields, rocks                               */
/* ------------------------------------------------------------------ */

/**
 * Landmark spot: somewhere ahead of the bike's stop on the signpost side, chosen to sit as close
 * to the centre of the rider's view as possible while staying clear of the winding road.
 */
function landmarkXZ(t, side) {
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  const s = sideAt(t);
  let best = null;
  for (let ahead = 14; ahead <= 28; ahead += 2) {
    for (let lateral = 6; lateral <= 14; lateral += 1) {
      const x = p.x + tan.x * ahead + s.x * lateral * side;
      const z = p.z + tan.z * ahead + s.z * lateral * side;
      if (distToRoad(x, z, 2) < 6) continue;
      const score = lateral / (ahead + 6) + Math.abs(ahead - 20) * 0.01;
      if (!best || score < best.score) best = { x, z, score };
    }
  }
  return best ? [best.x, best.z] : [p.x + s.x * 14 * side, p.z + s.z * 14 * side];
}

function useVillageLayout(milestoneTs) {
  return useMemo(() => {
    const r = rng(42);
    const houses = [];
    const reserved = []; // [x, z, radius]

    // Landmarks near each milestone get reserved space.
    milestoneTs.forEach((t, i) => {
      const p = curve.getPointAt(t);
      const s = sideAt(t);
      const dir = i % 2 === 0 ? 1 : -1;
      reserved.push([p.x + s.x * 4 * dir, p.z + s.z * 4 * dir, 2.5]);
      const [lx, lz] = landmarkXZ(t, dir);
      reserved.push([lx, lz, 7]);
    });

    const free = (x, z, rad) => reserved.every(([rx, rz, rr]) => (rx - x) ** 2 + (rz - z) ** 2 > (rr + rad) ** 2);

    const wallColors = S.walls;
    const roofColors = S.roofs;
    const accentColors = S.accents;
    let guard = 0;
    while (houses.length < 26 && guard++ < 2000) {
      const t = 0.02 + r() * 0.96;
      const p = curve.getPointAt(t);
      const s = sideAt(t);
      const dir = r() > 0.5 ? 1 : -1;
      const off = 7 + r() * 14;
      const x = p.x + s.x * off * dir + (r() - 0.5) * 3;
      const z = p.z + s.z * off * dir + (r() - 0.5) * 3;
      if (distToRoad(x, z, 2) < 5.5 || !free(x, z, 3.5)) continue;
      const faceRoad = Math.atan2(-s.x * dir, -s.z * dir);
      houses.push({
        x, z, y: terrainHeight(x, z),
        rot: faceRoad + (r() - 0.5) * 0.3,
        w: 2.4 + r() * 1.6, d: 2.2 + r() * 1.4, h: 1.7 + r() * 0.9,
        wall: wallColors[Math.floor(r() * wallColors.length)],
        roof: roofColors[Math.floor(r() * roofColors.length)],
        accent: accentColors[Math.floor(r() * accentColors.length)],
        style: r() > 0.5 ? 'flat' : 'gable',
      });
      reserved.push([x, z, 3.5]);
    }

    const pines = [];
    const rounds = [];
    guard = 0;
    while (pines.length + rounds.length < 420 && guard++ < 8000) {
      const x = (r() - 0.5) * 300;
      const z = 30 - r() * 320;
      const d = distToRoad(x, z, 3);
      if (d < 4.2 || !free(x, z, 1.2)) continue;
      if (d > 30 && r() < 0.45) continue;
      const scale = 0.7 + r() * 0.9 + (d > 40 ? 0.6 : 0);
      const tree = { x, z, y: terrainHeight(x, z, d), s: scale, hue: r() };
      (r() > 0.45 ? rounds : pines).push(tree);
    }

    const fields = [];
    guard = 0;
    while (fields.length < 10 && guard++ < 500) {
      const t = r();
      const p = curve.getPointAt(t);
      const s = sideAt(t);
      const dir = r() > 0.5 ? 1 : -1;
      const off = 12 + r() * 14;
      const x = p.x + s.x * off * dir;
      const z = p.z + s.z * off * dir;
      if (distToRoad(x, z, 2) < 9 || !free(x, z, 6)) continue;
      fields.push({ x, z, y: terrainHeight(x, z) + 0.06, rot: r() * Math.PI, w: 8 + r() * 6, d: 6 + r() * 5, gold: r() > 0.5 });
      reserved.push([x, z, 6]);
    }

    const lanterns = [];
    for (let t = 0.015; t < 0.99; t += 0.032) {
      const p = curve.getPointAt(t);
      const s = sideAt(t);
      const dir = Math.round(t * 1000) % 2 === 0 ? 1 : -1;
      lanterns.push([p.x + s.x * 2.3 * dir, p.z + s.z * 2.3 * dir]);
    }

    return { houses, pines, rounds, fields, lanterns };
  }, [milestoneTs]);
}

function InstancedTrees({ pines, rounds }) {
  const pineRef = useRef();
  const pineTopRef = useRef();
  const roundRef = useRef();
  const trunkRef = useRef();

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    const c = new THREE.Color();
    pines.forEach((t, i) => {
      m.position.set(t.x, t.y + 1.6 * t.s, t.z);
      m.scale.setScalar(t.s);
      m.rotation.set(0, t.hue * 6, 0);
      m.updateMatrix();
      pineRef.current.setMatrixAt(i, m.matrix);
      pineRef.current.setColorAt(i, c.set(S.pines[0]).offsetHSL(0, 0, (t.hue - 0.5) * 0.08));
      m.position.y = t.y + 2.6 * t.s;
      m.scale.setScalar(t.s * 0.72);
      m.updateMatrix();
      pineTopRef.current.setMatrixAt(i, m.matrix);
      pineTopRef.current.setColorAt(i, c.set(S.pines[1]).offsetHSL(0, 0, (t.hue - 0.5) * 0.08));
    });
    rounds.forEach((t, i) => {
      m.position.set(t.x, t.y + 1.9 * t.s, t.z);
      m.scale.set(t.s, t.s * 1.1, t.s);
      m.rotation.set(0, t.hue * 4, 0);
      m.updateMatrix();
      roundRef.current.setMatrixAt(i, m.matrix);
      // Mostly mint greens, with cherry-blossom pinks and a few sunny yellows.
      const tone = t.hue > 0.86 ? S.trees[3] : t.hue > 0.78 ? S.trees[2] : t.hue > 0.4 ? S.trees[1] : S.trees[0];
      roundRef.current.setColorAt(i, c.set(tone).offsetHSL(0, 0, (t.hue - 0.5) * 0.06));
    });
    [...pines, ...rounds].forEach((t, i) => {
      m.position.set(t.x, t.y + 0.5 * t.s, t.z);
      m.scale.set(t.s, t.s, t.s);
      m.rotation.set(0, 0, 0);
      m.updateMatrix();
      trunkRef.current.setMatrixAt(i, m.matrix);
    });
    [pineRef, pineTopRef, roundRef, trunkRef].forEach((r) => {
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
    });
  }, [pines, rounds]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[null, null, pines.length + rounds.length]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 1, 10]} />
        <meshStandardMaterial color={S.trunk} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={pineRef} args={[null, null, pines.length]} castShadow>
        <coneGeometry args={[0.95, 2.4, 20]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={pineTopRef} args={[null, null, pines.length]} castShadow>
        <coneGeometry args={[0.95, 1.9, 20]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={roundRef} args={[null, null, rounds.length]} castShadow>
        <icosahedronGeometry args={[1.1, 3]} />
        <meshStandardMaterial roughness={0.65} />
      </instancedMesh>
    </>
  );
}

function House({ x, y, z, rot, w, d, h, wall, roof, accent = '#c98b5b', style = 'gable', windowMat }) {
  const r = (w / Math.sqrt(3)) * 1.12;
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wall} roughness={0.55} />
      </mesh>
      {style === 'flat' ? (
        <mesh position={[0, h + 0.1, 0]} castShadow>
          <boxGeometry args={[w + 0.45, 0.2, d + 0.45]} />
          <meshStandardMaterial color={roof} roughness={0.5} />
        </mesh>
      ) : (
        <mesh position={[0, h + r / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[r, r, d + 0.35, 3]} />
          <meshStandardMaterial color={roof} roughness={0.5} flatShading />
        </mesh>
      )}
      {/* Wide glass window and a coloured door */}
      <mesh position={[-w * 0.18, h * 0.52, d / 2 + 0.01]} material={windowMat}>
        <planeGeometry args={[w * 0.46, h * 0.42]} />
      </mesh>
      <mesh position={[w * 0.28, 0.55, d / 2 + 0.01]}>
        <planeGeometry args={[0.5, 1.1]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>
      {/* Accent cladding stripe */}
      <mesh position={[w / 2 + 0.01, h / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[d * 0.35, h]} />
        <meshStandardMaterial color={accent} roughness={0.7} />
      </mesh>
    </group>
  );
}

function Fields({ fields }) {
  const textures = useMemo(() => {
    const make = (base, stripe) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = stripe;
      for (let i = 0; i < 128; i += 16) ctx.fillRect(0, i, 128, 7);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    return { gold: make(...S.fields[0]), green: make(...S.fields[1]) };
  }, []);
  return fields.map((f, i) => (
    <mesh key={i} position={[f.x, f.y, f.z]} rotation={[-Math.PI / 2, 0, f.rot]} receiveShadow>
      <planeGeometry args={[f.w, f.d]} />
      <meshStandardMaterial map={f.gold ? textures.gold : textures.green} roughness={1} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  ));
}

/* ------------------------------------------------------------------ */
/* Landmarks                                                           */
/* ------------------------------------------------------------------ */

function drawLabel(cv, text, color) {
  const ctx = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = S.signBg;
  ctx.fillRect(0, 0, W, H);
  // Accent bar + soft glow
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, color);
  g.addColorStop(1, S.landmark.accent);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 18, H);
  const glow = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, W * 0.6);
  glow.addColorStop(0, color + '55');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 74px "Space Grotesk", Inter, "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 52, H / 2 + 4, W - 80);
}

function labelTexture(text, color) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 180;
  drawLabel(cv, text, color);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // Redraw once the web font has loaded so the sign uses Space Grotesk.
  document.fonts?.ready.then(() => {
    drawLabel(cv, text, color);
    tex.needsUpdate = true;
  });
  return tex;
}

function Signpost({ t, label, color, side }) {
  const { position, rotation, texture } = useMemo(() => {
    const p = curve.getPointAt(t);
    const s = sideAt(t);
    const tan = curve.getTangentAt(t);
    const x = p.x + s.x * 3.2 * side;
    const z = p.z + s.z * 3.2 * side;
    // Face the approaching rider: back along the road, slightly toward its centre.
    const nx = -tan.x * 0.7 - s.x * side * 0.7;
    const nz = -tan.z * 0.7 - s.z * side * 0.7;
    return { position: [x, terrainHeight(x, z), z], rotation: Math.atan2(nx, nz), texture: labelTexture(label, color) };
  }, [t, label, color, side]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2.2, 12]} />
        <meshStandardMaterial color="#e9ecf8" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.25, 0]} castShadow>
        <boxGeometry args={[2.4, 0.86, 0.1]} />
        <meshStandardMaterial color={S.signBg} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.25, 0.051]}>
        <planeGeometry args={[2.4, 0.86]} />
        <meshStandardMaterial map={texture} roughness={0.4} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 2.85, 0]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

function WindTurbine({ position, rotation = 0 }) {
  const rotor = useRef();
  useFrame((_, dt) => {
    rotor.current.rotation.z += dt * (0.9 + journey.speed * 0.06);
  });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 4.5, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.34, 9, 20]} />
        <meshStandardMaterial color="#f7f8ff" roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[0, 9.1, 0.1]} castShadow>
        <boxGeometry args={[0.5, 0.5, 1.4]} />
        <meshStandardMaterial color="#f7f8ff" roughness={0.35} />
      </mesh>
      <group ref={rotor} position={[0, 9.1, 0.9]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.24, 0.5, 20]} />
          <meshStandardMaterial color={S.landmark.roof} roughness={0.4} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
            <mesh position={[0, 2.6, 0]} castShadow>
              <boxGeometry args={[0.32, 5, 0.06]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <mesh position={[0, 4.9, 0.005]}>
              <boxGeometry args={[0.2, 0.5, 0.065]} />
              <meshStandardMaterial color={S.landmark.accent} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Pond({ position }) {
  const duck = useRef();
  useFrame(({ clock }) => {
    const a = clock.elapsedTime * 0.3;
    duck.current.position.set(Math.cos(a) * 2.6, 0.12, Math.sin(a) * 1.8);
    duck.current.rotation.y = -a;
  });
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} scale={[1, 0.7, 1]} receiveShadow>
        <circleGeometry args={[4.5, 32]} />
        <meshStandardMaterial color={S.water} roughness={0.08} metalness={0.25} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[1, 0.7, 1]}>
        <ringGeometry args={[4.4, 5.1, 32]} />
        <meshStandardMaterial color="#eef3fb" roughness={0.6} />
      </mesh>
      <group ref={duck}>
        <mesh castShadow>
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshStandardMaterial color="#fafafa" />
        </mesh>
        <mesh position={[0.22, 0.22, 0]}>
          <sphereGeometry args={[0.15, 10, 10]} />
          <meshStandardMaterial color="#fafafa" />
        </mesh>
        <mesh position={[0.38, 0.2, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.06, 0.16, 6]} />
          <meshStandardMaterial color="#ffb547" />
        </mesh>
      </group>
    </group>
  );
}

function Barn({ position, rotation = 0 }) {
  // A modern A-frame studio with a full-height glass front.
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 2.6, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.1, 3.1, 5, 3]} />
        <meshStandardMaterial color={S.landmark.dark} roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0, 1.65, 2.51]}>
        <circleGeometry args={[2.6, 3, Math.PI / 2 - Math.PI / 3, (Math.PI * 2) / 3]} />
        <meshStandardMaterial color="#9fd3ff" emissive="#ffd59e" emissiveIntensity={0.15} roughness={0.1} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 3.4]} receiveShadow>
        <boxGeometry args={[4, 0.12, 1.6]} />
        <meshStandardMaterial color="#c98b5b" roughness={0.8} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[3.8 + i * 0.9, 0.45, 1.4 - i * 0.7]} castShadow>
          <sphereGeometry args={[0.45 + i * 0.08, 20, 16]} />
          <meshStandardMaterial color={[S.trees[1], S.trees[3], S.trees[0]][i]} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function PostOffice({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 3, 3.4]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.1, 0]} castShadow>
        <boxGeometry args={[4.9, 0.22, 3.9]} />
        <meshStandardMaterial color={S.landmark.roof} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.6, 1.71]}>
        <planeGeometry args={[3.2, 1.6]} />
        <meshStandardMaterial color="#9fd3ff" emissive="#ffd59e" emissiveIntensity={0.15} roughness={0.1} />
      </mesh>
      <mesh position={[2.9, 0.6, 1.4]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 1.2, 24]} />
        <meshStandardMaterial color={S.landmark.accent} roughness={0.4} />
      </mesh>
      <mesh position={[2.9, 1.25, 1.4]}>
        <sphereGeometry args={[0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={S.landmark.accent} roughness={0.4} />
      </mesh>
    </group>
  );
}

const LANDMARKS = [null, 'cottage', 'windmill', 'barn', 'pond', 'post'];

function Landmark({ kind, t, side, windowMat }) {
  const { pos, rot } = useMemo(() => {
    // Placed in the rider's view: ahead of the bike, on the signpost side (opposite the text card).
    const [x, z] = landmarkXZ(t, side);
    // Turn the front of the landmark toward the approaching rider.
    const viewer = curve.getPointAt(Math.max(0, t - 0.02));
    return { pos: [x, terrainHeight(x, z), z], rot: Math.atan2(viewer.x - x, viewer.z - z) };
  }, [t, side]);
  switch (kind) {
    case 'windmill':
      return (
        <group scale={0.75}>
          <WindTurbine position={pos.map((v) => v / 0.75)} rotation={rot} />
        </group>
      );
    case 'pond':
      return <Pond position={pos} />;
    case 'barn':
      return <Barn position={pos} rotation={rot} />;
    case 'post':
      return <PostOffice position={pos} rotation={rot} />;
    case 'cottage':
      return (
        <House x={pos[0]} y={pos[1]} z={pos[2]} rot={rot} w={4.2} d={3.2} h={2.6} wall="#ffffff" roof={S.landmark.roof} accent={S.landmark.accent} style="flat" windowMat={windowMat} />
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Ambient life: clouds, lanterns, fireflies, birds                    */
/* ------------------------------------------------------------------ */

function Clouds() {
  const group = useRef();
  const clouds = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: 18 }, () => ({
      x: (r() - 0.5) * 260,
      y: 24 + r() * 14,
      z: 20 - r() * 300,
      s: 2 + r() * 3,
      puffs: Array.from({ length: 4 + Math.floor(r() * 3) }, (_, i) => [i * 1.3 - 2, r() * 0.8, (r() - 0.5) * 1.2, 1 + r() * 0.8]),
    }));
  }, []);
  useFrame((_, dt) => {
    group.current.children.forEach((c) => {
      c.position.x += dt * 1.2;
      if (c.position.x > 140) c.position.x = -140;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {c.puffs.map(([x, y, z, s], j) => (
            <mesh key={j} position={[x, y, z]} scale={s}>
              <icosahedronGeometry args={[1, 3]} />
              <meshStandardMaterial color="#ffffff" roughness={1} emissive="#ffffff" emissiveIntensity={0.15} transparent opacity={0.92} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Lanterns({ lanterns, bulbMat }) {
  const posts = useRef();
  const bulbs = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    lanterns.forEach(([x, z], i) => {
      m.position.set(x, 0.9, z);
      m.updateMatrix();
      posts.current.setMatrixAt(i, m.matrix);
      m.position.y = 1.9;
      m.updateMatrix();
      bulbs.current.setMatrixAt(i, m.matrix);
    });
    posts.current.instanceMatrix.needsUpdate = true;
    bulbs.current.instanceMatrix.needsUpdate = true;
  }, [lanterns]);
  return (
    <>
      <instancedMesh ref={posts} args={[null, null, lanterns.length]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 1.8, 10]} />
        <meshStandardMaterial color={S.landmark.dark} metalness={0.5} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[null, null, lanterns.length]} material={bulbMat}>
        <sphereGeometry args={[0.13, 16, 12]} />
      </instancedMesh>
    </>
  );
}

function Fireflies({ start }) {
  const points = useRef();
  const { geometry, base } = useMemo(() => {
    const r = rng(3);
    const count = 160;
    const arr = new Float32Array(count * 3);
    const base = [];
    for (let i = 0; i < count; i++) {
      const t = start + r() * (1 - start);
      const p = curve.getPointAt(Math.min(t, 1));
      const x = p.x + (r() - 0.5) * 26;
      const z = p.z + (r() - 0.5) * 26;
      const y = 0.6 + r() * 2.5;
      base.push([x, y, z, r() * 10]);
      arr.set([x, y, z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return { geometry: g, base };
  }, [start]);
  const glow = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(160,250,255,0.8)');
    grad.addColorStop(1, 'rgba(160,250,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }, [start]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geometry.attributes.position;
    base.forEach(([x, y, z, ph], i) => {
      pos.setXYZ(i, x + Math.sin(t * 0.5 + ph) * 0.6, y + Math.sin(t * 0.9 + ph * 2) * 0.3, z + Math.cos(t * 0.4 + ph) * 0.6);
    });
    pos.needsUpdate = true;
    points.current.material.opacity = journey.dusk * (0.7 + Math.sin(t * 3) * 0.3);
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial map={glow} color={S.firefly} size={0.45} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Birds() {
  const group = useRef();
  const birds = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ off: [(i % 3) * 1.4 - 1.4, Math.floor(i / 3) * 0.5, Math.floor(i / 3) * -1.2 - (i % 2)], ph: i })), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = t * 0.05;
    const p = curve.getPointAt(progressToT(journey.smooth));
    group.current.position.set(p.x + Math.cos(a) * 30, 18 + Math.sin(t * 0.3) * 1.5, p.z - 25 + Math.sin(a) * 20);
    group.current.rotation.y = -a + Math.PI;
    group.current.children.forEach((b, i) => {
      const flap = Math.sin(t * 8 + birds[i].ph) * 0.6;
      b.children[0].rotation.z = flap;
      b.children[1].rotation.z = -flap;
    });
  });
  return (
    <group ref={group}>
      {birds.map((b, i) => (
        <group key={i} position={b.off}>
          <mesh position={[-0.25, 0, 0]}>
            <boxGeometry args={[0.5, 0.03, 0.15]} />
            <meshBasicMaterial color="#2b2f45" />
          </mesh>
          <mesh position={[0.25, 0, 0]}>
            <boxGeometry args={[0.5, 0.03, 0.15]} />
            <meshBasicMaterial color="#2b2f45" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */

const SIGN_COLORS = S.signColors;

export default function World({ milestones }) {
  const milestoneTs = useMemo(() => milestones.map((_, i) => progressToT(i / (milestones.length - 1))), [milestones]);
  const layout = useVillageLayout(milestoneTs);

  // Materials that react to the time of day.
  // Street lamps glow neon cyan after dark; windows warm up.
  const bulbMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: S.lamp, emissiveIntensity: S.lampBase, toneMapped: false }),
    [],
  );
  const windowMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#9fd3ff', emissive: '#ffd59e', emissiveIntensity: 0, roughness: 0.1, metalness: 0.3 }),
    [],
  );
  useFrame(() => {
    bulbMat.emissiveIntensity = S.lampBase + journey.dusk * 3.5;
    const glow = Math.max(S.windowBase, journey.dusk * 1.6);
    windowMat.emissiveIntensity = glow;
    windowMat.color.set(glow > 0.45 ? '#ffe7b0' : '#9fd3ff');
  });

  return (
    <group>
      <Terrain />
      <Road />
      <InstancedTrees pines={layout.pines} rounds={layout.rounds} />
      {layout.houses.map((h, i) => (
        <House key={i} {...h} windowMat={windowMat} />
      ))}
      <Fields fields={layout.fields} />
      <Lanterns lanterns={layout.lanterns} bulbMat={bulbMat} />
      {milestones.map((m, i) => (
        <Signpost key={m.id} t={Math.min(milestoneTs[i] + 0.012, 0.995)} label={m.sign} color={SIGN_COLORS[i % SIGN_COLORS.length]} side={i % 2 === 0 ? 1 : -1} />
      ))}
      {milestones.map((m, i) => (
        <Landmark key={`lm-${m.id}`} kind={LANDMARKS[i % LANDMARKS.length]} t={milestoneTs[i]} side={i % 2 === 0 ? 1 : -1} windowMat={windowMat} />
      ))}
      <Clouds />
      <Birds />
      <Fireflies start={0.7} />
    </group>
  );
}

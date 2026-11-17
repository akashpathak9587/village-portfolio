import { Component, useEffect, useLayoutEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import VillageJourney from './scene/VillageJourney';
import { milestones, profile } from './config';
import RouteBar from './components/RouteBar';
import Sections from './components/Sections';
import useJourneyScroll from './components/useJourneyScroll';
import useSmoothWheel from './components/useSmoothWheel';
import useHashRoute, { ROUTES, savedScroll } from './components/useHashRoute';
import ProjectBook from './book/ProjectBook';

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div className="scene-fallback" /> : this.props.children;
  }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function JourneyView({ route, onReady }) {
  const [webgl] = useState(hasWebGL);
  const ride = useJourneyScroll(milestones.length);
  useSmoothWheel();

  useLayoutEffect(() => {
    // Return the visitor to where they left the ride.
    window.scrollTo(0, savedScroll[ROUTES.journey] || 0);
  }, []);

  useEffect(() => {
    document.title = `${profile.name} · Portfolio`;
    if (!webgl) onReady();
  }, [webgl, onReady]);

  return (
    <>
      <div className="scene" aria-hidden="true">
        {webgl ? (
          <SceneBoundary>
            <Canvas
              shadows
              dpr={[1, 1.5]}
              camera={{ fov: 50, near: 0.1, far: 400, position: [10, 12, 20] }}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
              onCreated={() => setTimeout(onReady, 400)}
            >
              <VillageJourney milestones={milestones} reducedMotion={reducedMotion} />
            </Canvas>
          </SceneBoundary>
        ) : (
          <div className="scene-fallback" />
        )}
      </div>
      <RouteBar milestones={milestones} ride={ride} route={route} />
      <Sections profile={profile} milestones={milestones} onStartRide={ride.startAuto} />
    </>
  );
}

export default function App() {
  const route = useHashRoute();
  const [ready, setReady] = useState(route === ROUTES.book);
  const markReady = useState(() => () => setReady(true))[0];

  return (
    <>
      {route === ROUTES.book ? (
        <ProjectBook profile={profile} route={route} reducedMotion={reducedMotion} />
      ) : (
        <JourneyView route={route} onReady={markReady} />
      )}
      <div className={`loader ${ready ? 'loader--done' : ''}`} role="status" aria-live="polite">
        <div className="loader__wheel" />
        <p>Pumping up the tyres…</p>
      </div>
    </>
  );
}

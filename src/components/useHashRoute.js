import { useEffect, useState } from 'react';

export const ROUTES = { journey: '/', book: '/project-book' };

const read = () => {
  const h = window.location.hash.replace(/^#/, '');
  return h === ROUTES.book ? ROUTES.book : ROUTES.journey;
};

/** Remembers where the visitor was on the ride so switching tabs doesn't lose their place. */
export const savedScroll = { [ROUTES.journey]: 0, [ROUTES.book]: 0 };

/** Tiny hash router: '#/' is the bike ride, '#/project-book' is the book. */
export default function useHashRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    let current = read();
    const onChange = () => {
      const next = read();
      if (next === current) return;
      savedScroll[current] = window.scrollY;
      current = next;
      setRoute(next);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

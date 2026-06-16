import { useLayoutEffect, useState } from 'react';

// Measures the sticky global <header> height so sidebars can sit flush beneath
// it (no gap, no overlap) and fill the remaining viewport height.
export function useHeaderHeight(fallback = 72) {
  const [height, setHeight] = useState(fallback);
  useLayoutEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const measure = () => setHeight(Math.round(header.getBoundingClientRect().height) || fallback);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [fallback]);
  return height;
}

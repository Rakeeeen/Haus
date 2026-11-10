import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only unmounts what a test rendered when `afterEach` is a global; here it isn't, so do it by hand.
afterEach(() => cleanup());

// jsdom has no layout, so it has neither ResizeObserver nor matchMedia. Minimal stand-ins: nothing is ever observed or matched.
if (typeof window !== 'undefined') {
  window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

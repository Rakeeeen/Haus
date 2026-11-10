import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only unmounts what a test rendered when `afterEach` is a global; here it isn't, so do it by hand.
afterEach(() => cleanup());

// Tests de la vérification des étapes dans les réglages.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { validateSteps } from '../src/screens/settings.js';

const steps = (...days) => days.map((day) => ({ day, method: 'recall' }));

describe('validateSteps', () => {
  it('accepte des jours croissants commençant à J0', () => {
    expect(validateSteps(steps(0, 1, 3, 7, 14, 30, 60))).toBeNull();
  });
  it('refuse les erreurs courantes', () => {
    expect(validateSteps(steps(0))).toMatch(/au moins 2/);
    expect(validateSteps(steps(1, 3))).toMatch(/J0/);
    expect(validateSteps(steps(0, 7, 3))).toMatch(/augmenter/);
    expect(validateSteps(steps(0, NaN))).toMatch(/invalide/);
  });
});

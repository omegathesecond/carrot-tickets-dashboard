import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATES, loadCalibration, saveCalibration,
  loadCustomTemplates, saveCustomTemplate, deleteCustomTemplate,
} from '../templates';

// node environment: shim the tiny localStorage surface the lib touches.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

beforeEach(() => store.clear());

describe('DEFAULT_TEMPLATES', () => {
  it('ships 10-up templates whose bands fit inside the page', () => {
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    for (const t of DEFAULT_TEMPLATES) {
      expect(t.bandsPerSheet).toBe(10);
      const stackHeight = t.marginTopMm + t.bandsPerSheet * t.bandHeightMm + (t.bandsPerSheet - 1) * t.gapYMm;
      expect(stackHeight).toBeLessThanOrEqual(t.pageHeightMm);
      expect(t.marginLeftMm + t.bandWidthMm).toBeLessThanOrEqual(t.pageWidthMm);
    }
  });
});

describe('calibration persistence', () => {
  it('defaults to zero offsets and round-trips saves per template', () => {
    expect(loadCalibration('a4-10up-25mm')).toEqual({ dxMm: 0, dyMm: 0 });
    saveCalibration('a4-10up-25mm', { dxMm: 1.5, dyMm: -0.5 });
    expect(loadCalibration('a4-10up-25mm')).toEqual({ dxMm: 1.5, dyMm: -0.5 });
    expect(loadCalibration('letter-10up-25mm')).toEqual({ dxMm: 0, dyMm: 0 });
  });
});

describe('custom templates', () => {
  it('saves, overwrites by key, and deletes', () => {
    const t = { ...DEFAULT_TEMPLATES[0], key: 'custom-1', name: 'My sheet' };
    saveCustomTemplate(t);
    saveCustomTemplate({ ...t, name: 'My sheet v2' });
    expect(loadCustomTemplates()).toHaveLength(1);
    expect(loadCustomTemplates()[0].name).toBe('My sheet v2');
    deleteCustomTemplate('custom-1');
    expect(loadCustomTemplates()).toHaveLength(0);
  });
});

// @vitest-environment jsdom
import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ReportCardPreview } from '../../../packages/shared/src/components/ReportCardPreview';
import type { ReportCardSheetData } from '@school/shared';
vi.mock('../../../packages/shared/src/components/ReportCardSheet', () => ({ ReportCardSheet: () => <div>Test sheet</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function narrow() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 350, height: 800, x: 0, y: 0, top: 0, left: 0, right: 350, bottom: 800, toJSON: () => ({}) });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
}
test('default portal preview fits a narrow container', async () => {
  narrow();
  const { container } = render(<ReportCardPreview reportCard={{} as ReportCardSheetData} backHref="/results" />);
  await waitFor(() => expect(parseFloat((container.querySelector('.rc-print-root') as HTMLElement).style.width)).toBeCloseTo(350));
});
test('explicit staff zoom is not silently reduced by the container', () => {
  narrow();
  const { container } = render(<ReportCardPreview reportCard={{} as ReportCardSheetData} backHref="/results" previewScale={1} />);
  expect(parseFloat((container.querySelector('.rc-print-root') as HTMLElement).style.width)).toBeCloseTo(210 * 96 / 25.4);
});

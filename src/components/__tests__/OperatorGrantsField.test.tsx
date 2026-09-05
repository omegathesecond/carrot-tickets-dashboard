// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OperatorGrantsField } from '@/components/OperatorGrantsField';
import type { OperatorGrant, OperatorPopulation } from '@/lib/api';

afterEach(cleanup);

const renderField = (value: OperatorGrant[] = [], population: OperatorPopulation = 'gate') => {
  const onChange = vi.fn();
  render(<OperatorGrantsField population={population} value={value} onChange={onChange} />);
  return { onChange };
};

describe('OperatorGrantsField', () => {
  it('shows the tag-desk grant unchecked when the person does not hold it', () => {
    renderField([]);
    expect(screen.getByRole('switch', { name: /works the register desk/i })).toHaveProperty(
      'dataset.state',
      'unchecked',
    );
  });

  it('adds the grant when switched on', () => {
    const { onChange } = renderField([]);
    fireEvent.click(screen.getByRole('switch', { name: /works the register desk/i }));
    expect(onChange).toHaveBeenCalledWith(['issue_tags']);
  });

  it('removes it when switched off, leaving other grants alone', () => {
    const { onChange } = renderField(['issue_tags']);
    fireEvent.click(screen.getByRole('switch', { name: /works the register desk/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('does not fire while disabled', () => {
    const onChange = vi.fn();
    render(<OperatorGrantsField population="gate" value={[]} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('switch', { name: /works the register desk/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('population filtering', () => {
  it('offers a gate operator the tag desk but not stock', () => {
    renderField([], 'gate');
    expect(screen.getByRole('switch', { name: /works the register desk/i })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /stock/i })).toBeNull();
  });

  it('offers a stall operator stock but not the tag desk', () => {
    renderField([], 'merchant');
    expect(screen.getByRole('switch', { name: /stock/i })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /works the register desk/i })).toBeNull();
  });

  it('offers a cashier the tag desk, matching the gate', () => {
    renderField([], 'cashier');
    expect(screen.getByRole('switch', { name: /works the register desk/i })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /stock/i })).toBeNull();
  });

  it('leaves a grant the surface does not show untouched when toggling one it does', () => {
    // A stall operator who somehow carries issue_tags must not silently lose it
    // because this surface cannot render it.
    const onChange = vi.fn();
    render(
      <OperatorGrantsField population="merchant" value={['issue_tags']} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('switch', { name: /stock/i }));
    expect(onChange).toHaveBeenCalledWith(['issue_tags', 'manage_stock']);
  });
});

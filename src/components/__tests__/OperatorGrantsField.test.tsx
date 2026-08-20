// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OperatorGrantsField } from '@/components/OperatorGrantsField';
import type { OperatorGrant } from '@/lib/api';

afterEach(cleanup);

const renderField = (value: OperatorGrant[] = []) => {
  const onChange = vi.fn();
  render(<OperatorGrantsField value={value} onChange={onChange} />);
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
    render(<OperatorGrantsField value={[]} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('switch', { name: /works the register desk/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

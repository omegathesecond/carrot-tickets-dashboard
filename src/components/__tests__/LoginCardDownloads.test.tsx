// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoginCardDownloads } from '@/components/LoginCardDownloads';
const renderCard = vi.fn(); const save = vi.fn(); const share = vi.fn();
vi.mock('@/lib/operatorLoginCards', async original => ({ ...await original<typeof import('@/lib/operatorLoginCards')>(), renderLoginCard: (...args: unknown[]) => renderCard(...args) }));
vi.mock('@/lib/ticketDownloads', () => ({ saveBlob: (...args: unknown[]) => save(...args) }));
const card = { operatorName: 'Nomsa Shongwe', stallName: 'The Meat Hub', phoneNumber: '+26878422613', loginCode: 'ABC123', pin: '123456' };
beforeEach(() => { renderCard.mockResolvedValue(new Blob(['image'], { type: 'image/png' })); share.mockResolvedValue(undefined); Object.defineProperty(navigator, 'share', { configurable: true, value: share }); Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('requires the named recipient confirmation before sharing the one named image', async () => {
 render(<LoginCardDownloads card={card} />);
 const button = await screen.findByRole('button', { name: 'Share this person’s image' });
 expect(button).toHaveProperty('disabled', true);
 await waitFor(() => expect(screen.getByRole('button', { name: 'Download image' })).toHaveProperty('disabled', false));
 fireEvent.click(button); expect(share).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(button);
 await waitFor(() => expect(share).toHaveBeenCalled());
 const sent = share.mock.calls[0]![0];
 expect(sent.files).toHaveLength(1); expect(sent.files[0].name).toBe('nomsa-shongwe__the-meat-hub__ABC123.png');
 expect(sent.text).toContain('Nomsa Shongwe'); expect(sent.text).not.toContain(card.pin);
});
it('clears recipient confirmation and prevents sharing the prior image after changing person', async () => {
 const view = render(<LoginCardDownloads card={card} />);
 await waitFor(() => expect(screen.getByRole('button', { name: 'Download image' })).toHaveProperty('disabled', false));
 fireEvent.click(screen.getByRole('checkbox'));
 let finish!: (value: Blob) => void;
 renderCard.mockReturnValue(new Promise<Blob>(resolve => { finish = resolve; }));
 view.rerender(<LoginCardDownloads card={{ ...card, operatorName: 'Sipho Mabuza', loginCode: 'DEF456' }} />);
 expect(screen.queryByRole('button', { name: 'Share this person’s image' })).toBeNull();
 expect(screen.getByRole('button', { name: 'Download image' })).toHaveProperty('disabled', true);
 await act(async () => finish(new Blob(['new image'], { type: 'image/png' })));
 expect(await screen.findByRole('button', { name: 'Share this person’s image' })).toHaveProperty('disabled', true);
 expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false');
});

it('offers named downloads with explicit instructions when direct file sharing is unsupported', async () => {
 Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
 render(<LoginCardDownloads card={card} />);
 expect(await screen.findByText(/This browser does not support direct file sharing/)).toHaveProperty('textContent', expect.stringContaining('Nomsa Shongwe'));
 expect(screen.queryByRole('button', { name: 'Share this person’s image' })).toBeNull();
 fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
 expect(save).toHaveBeenCalledWith(expect.any(File), 'nomsa-shongwe__the-meat-hub__ABC123.png');
});

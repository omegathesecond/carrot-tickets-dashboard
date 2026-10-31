import { describe, expect, it, vi } from 'vitest';
import { loginCardSvg, loginCardFilename, loadLoginCards, type LoginCardTarget } from '@/lib/operatorLoginCards';
const card = { operatorName: 'Nomsa Shongwe', stallName: 'The Meat Hub', phoneNumber: '+26878422613', loginCode: 'ABC123', pin: '123456' };
const targets: LoginCardTarget[] = [{ id: '1', ...card }, { id: '2', ...card, operatorName: 'Sipho Mabuza', loginCode: 'DEF456' }];
describe('named login cards', () => {
 it('names files for the recipient and stall, with a unique ID but no PIN', () => {
  expect(loginCardFilename(card, 'png')).toBe('nomsa-shongwe__the-meat-hub__ABC123.png');
  expect(loginCardFilename(card, 'pdf')).not.toContain(card.pin);
 });
 it('escapes names and keeps credential labels in the image', () => {
  const svg = loginCardSvg({ ...card, operatorName: '<script> & Nomsa' });
  expect(svg).not.toContain('<script>'); expect(svg).toContain('&lt;script&gt;');
  expect(svg).not.toContain('Install POS'); expect(svg).not.toContain('get-pos-app'); expect(svg).toContain('USER ID'); expect(svg).toContain(card.pin); expect(svg).toContain('For the named operator only.');
 });
 it('rejects an incomplete login instead of producing a usable-looking card', () => {
  expect(() => loginCardSvg({ ...card, pin: '' })).toThrow('incomplete');
 });
 it('loads only the requested accounts and keeps their identities bound to each PIN', async () => {
  const reveal = vi.fn().mockResolvedValueOnce({ loginCode: 'ABC123', pin: '111111' }).mockResolvedValueOnce({ loginCode: 'DEF456', pin: '222222' });
  const cards = await loadLoginCards(targets, reveal);
  expect(cards.map(c => [c.operatorName, c.loginCode, c.pin])).toEqual([['Nomsa Shongwe', 'ABC123', '111111'], ['Sipho Mabuza', 'DEF456', '222222']]);
 });
 it('fails the pack by name if any PIN cannot be read', async () => {
  const reveal = vi.fn().mockResolvedValueOnce({ loginCode: 'ABC123', pin: '111111' }).mockRejectedValueOnce(new Error('Reset this PIN once'));
  await expect(loadLoginCards(targets, reveal)).rejects.toThrow('Sipho Mabuza at The Meat Hub: Reset this PIN once');
 });
 it('refuses credentials returned for a different User ID', async () => {
  await expect(loadLoginCards([targets[0]!], vi.fn().mockResolvedValue({ loginCode: 'BAD999', pin: '111111' }))).rejects.toThrow('User ID changed');
 });
 it('does not invent logins for a stall without staff', async () => {
  const reveal = vi.fn(); await expect(loadLoginCards([], reveal)).rejects.toThrow('No active till logins'); expect(reveal).not.toHaveBeenCalled();
 });
});

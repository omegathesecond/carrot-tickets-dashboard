import type { TicketSale } from '@/types';

export const CHANNEL_LABEL: Record<string, string> = {
  online: 'Online',
  box_office: 'Organizer', // organizer/vendor + staff selling directly; stored value stays box_office
  reseller_pos: 'Reseller POS',
};

/** Human label for a sale's channel, '—' when unknown (legacy/unset). */
export function channelLabel(channel?: string): string {
  return channel ? CHANNEL_LABEL[channel] ?? channel : '—';
}

/** Reseller · hub sub-line for reseller_pos sales, else ''. */
export function channelSource(sale: Pick<TicketSale, 'channel' | 'resellerId' | 'hubId'>): string {
  if (sale.channel !== 'reseller_pos') return '';
  const reseller = typeof sale.resellerId === 'object' ? sale.resellerId?.name : '';
  const hub = typeof sale.hubId === 'object' ? sale.hubId?.name : '';
  return [reseller, hub].filter(Boolean).join(' · ');
}

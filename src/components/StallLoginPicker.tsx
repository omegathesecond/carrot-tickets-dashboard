import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { matchesSearch } from '@/lib/search';
import { loadLoginCards, type LoginCard, type LoginCardTarget } from '@/lib/operatorLoginCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OperatorCredentialsDialog } from '@/components/OperatorCredentialsDialog';

export function StallLoginPicker({ eventId, eventName, loadTargets, disabled = false }: { eventId: string; eventName: string; loadTargets: () => Promise<LoginCardTarget[]>; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [card, setCard] = useState<LoginCard | null>(null);
  const people = useQuery({ queryKey: ['stall-login-people', eventId], queryFn: loadTargets, enabled: open, retry: false });
  const select = useMutation({
    gcTime: 0,
    mutationFn: async (target: LoginCardTarget) => (await loadLoginCards([target], id => apiClient.merchantOperators.revealPin(id)))[0]!,
    onSuccess: value => { setCard(value); setOpen(false); setSearch(''); },
    onError: (e: Error) => toast.error(e.message),
  });
  const visible = people.data?.filter(person => matchesSearch(search, person.operatorName, person.stallName, person.phoneNumber, person.loginCode)).sort((a, b) => a.operatorName.localeCompare(b.operatorName) || a.stallName.localeCompare(b.stallName)) ?? [];
  return <>
    <Button size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>Share one login</Button>
    <Dialog open={open} onOpenChange={value => { if (!select.isPending) { setOpen(value); if (!value) setSearch(''); } }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Choose the person’s login card</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{eventName}</p>
        <Input type="search" aria-label="Find a stall operator" placeholder="Search person, stall, User ID or phone…" value={search} onChange={e => setSearch(e.target.value)} />
        {people.isPending || people.isFetching ? <p className="text-sm text-muted-foreground">Loading people…</p> : people.isError ? <div role="alert"><p className="text-sm text-red-600">Could not load stall logins: {people.error.message}</p><Button size="sm" variant="outline" onClick={() => people.refetch()}>Retry people</Button></div> : !people.data?.length ? <p className="text-sm text-muted-foreground">No active till logins. Add people to the stalls first.</p> : !visible.length ? <p className="text-sm text-muted-foreground">No people match your search.</p> : <ul className="divide-y rounded-lg border">
          {visible.map(person => <li key={person.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0"><p className="font-semibold break-words">{person.operatorName}</p><p className="text-sm text-muted-foreground">{person.stallName}</p><p className="text-xs text-muted-foreground">{person.loginCode}{person.phoneNumber ? ` · ${person.phoneNumber}` : ''}</p></div>
            <Button size="sm" variant="outline" disabled={select.isPending} aria-label={`Open login card for ${person.operatorName} at ${person.stallName}`} onClick={() => select.mutate(person)}>Open card</Button>
          </li>)}
        </ul>}
      </DialogContent>
    </Dialog>
    {card && <OperatorCredentialsDialog open title={`${card.operatorName} — login card`} loginCode={card.loginCode} pin={card.pin} businessName={card.stallName} cardIdentity={card} onClose={() => { setCard(null); select.reset(); }} />}
  </>;
}

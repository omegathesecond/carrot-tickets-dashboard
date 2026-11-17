import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { downloadLoginCards, loadLoginCards, type LoginCardTarget, type LoginExportFormat } from '@/lib/operatorLoginCards';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

export function LoginExports({ loadTargets, revealPin, name, disabled = false }: { loadTargets: () => Promise<LoginCardTarget[]>; revealPin: (id: string) => Promise<{ loginCode: string; pin: string }>; name: string; disabled?: boolean }) {
  const exportCards = useMutation({
    gcTime: 0,
    mutationFn: async (format: LoginExportFormat) => {
      const cards = await loadLoginCards(await loadTargets(), revealPin);
      await downloadLoginCards(cards, format, name);
    },
    onSuccess: () => toast.success('Login cards downloaded — each person has a named card.'),
    onError: (e: Error) => toast.error(e.message),
  });
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={disabled || exportCards.isPending}>{exportCards.isPending ? 'Preparing logins…' : 'Download all logins'}</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => exportCards.mutate('images')}>Separate named images (.zip)</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => exportCards.mutate('pdfs')}>Separate named PDFs (.zip)</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => exportCards.mutate('print')}>Print pack — all logins in one PDF</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

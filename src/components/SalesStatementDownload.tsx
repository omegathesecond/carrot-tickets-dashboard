import { useMutation } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function SalesStatementDownload({ kind, id, name }: { kind: 'event' | 'merchant'; id: string; name: string }) {
  const { user } = useAuth();
  const download = useMutation({
    mutationFn: (format: 'csv' | 'pdf') => {
      const resource = kind === 'event' ? 'events' : 'merchants';
      const filename = `${name.replace(/[^a-z0-9]+/gi, '_')}_sales_statement.${format}`;
      return apiClient.downloadStatement(`/tickets/${resource}/${id}/sales-statement?format=${format}`, filename);
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to download sales statement'),
  });
  if (!user?.isSuperAdmin && !user?.permissions?.includes('tickets:export_reports')) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Download sales statement">
      {(['csv', 'pdf'] as const).map(format => (
        <Button key={format} variant="outline" size="sm" disabled={download.isPending} onClick={() => download.mutate(format)}>
          {download.isPending && download.variables === format ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Sales statement ({format.toUpperCase()})
        </Button>
      ))}
    </div>
  );
}

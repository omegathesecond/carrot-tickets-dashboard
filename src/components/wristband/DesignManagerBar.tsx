import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FilePlus2, Save, Copy, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { WristbandDesignDoc } from '@/lib/wristband/design';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type NamePromptMode = 'save' | 'saveAs' | 'duplicate';

const NAME_PROMPT_TITLE: Record<NamePromptMode, string> = {
  save: 'Name this design',
  saveAs: 'Save as new design',
  duplicate: 'Duplicate design',
};

/**
 * Design select + New/Save/Save as/Duplicate/Delete. Save updates the
 * currently-loaded design in place; Save as and Duplicate always create a
 * new design row (name prompted via a small Dialog since neither can infer
 * one). All API failures surface via toast.error — no silent fallback.
 */
export function DesignManagerBar({ eventId, current, onLoad, onSaved, dirty, buildDoc }: {
  eventId: string;
  current: WristbandDesignDoc | null;
  onLoad: (d: WristbandDesignDoc) => void;
  onSaved: (d: WristbandDesignDoc) => void;
  dirty: boolean;
  buildDoc: () => Omit<WristbandDesignDoc, '_id'>;
}) {
  const queryClient = useQueryClient();
  const [namePrompt, setNamePrompt] = useState<NamePromptMode | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const queryKey = ['wristband-designs', eventId];
  const { data: designs = [] } = useQuery({
    queryKey,
    queryFn: () => apiClient.wristbands.listDesigns(eventId),
    enabled: !!eventId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (doc: Omit<WristbandDesignDoc, '_id'>) => apiClient.wristbands.createDesign(doc),
    onSuccess: (created) => {
      invalidate();
      onSaved(created);
      toast.success(`Saved "${created.name}"`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save design'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<WristbandDesignDoc> }) =>
      apiClient.wristbands.updateDesign(id, patch),
    onSuccess: (updated) => {
      invalidate();
      onSaved(updated);
      toast.success(`Saved "${updated.name}"`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save design'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.wristbands.deleteDesign(id),
    onSuccess: () => {
      invalidate();
      toast.success('Design deleted');
      setConfirmDelete(false);
      onLoad(blankDoc());
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete design');
      setConfirmDelete(false);
    },
  });

  const blankDoc = (): WristbandDesignDoc => ({
    eventId,
    name: 'Untitled',
    sheetTemplate: buildDoc().sheetTemplate,
    designJson: { background: '#ffffff', elements: [] },
  });

  const openNamePrompt = (mode: NamePromptMode) => {
    setNameValue(mode === 'duplicate' && current ? `${current.name} (copy)` : (current?.name ?? 'Untitled'));
    setNamePrompt(mode);
  };

  const handleSave = () => {
    if (current?._id) {
      updateMutation.mutate({ id: current._id, patch: buildDoc() });
    } else {
      openNamePrompt('save');
    }
  };

  const confirmNamePrompt = () => {
    const name = nameValue.trim();
    if (!name) {
      toast.error('Enter a name for the design');
      return;
    }
    createMutation.mutate({ ...buildDoc(), name });
    setNamePrompt(null);
  };

  const handleDesignSelect = (id: string) => {
    const d = designs.find((x) => x._id === id);
    if (d) onLoad(d);
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-56">
        <Select value={current?._id ?? ''} onValueChange={handleDesignSelect}>
          <SelectTrigger><SelectValue placeholder="Load a saved design" /></SelectTrigger>
          <SelectContent>
            {designs.filter((d) => d._id).map((d) => (
              <SelectItem key={d._id} value={d._id as string}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" size="sm" onClick={() => onLoad(blankDoc())}>
        <FilePlus2 className="mr-1.5 h-4 w-4" /> New
      </Button>

      <Button size="sm" disabled={saving} onClick={handleSave} className="relative">
        <Save className="mr-1.5 h-4 w-4" /> Save
        {dirty && (
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-orange-500" title="Unsaved changes" />
        )}
      </Button>

      <Button variant="outline" size="sm" disabled={saving} onClick={() => openNamePrompt('saveAs')}>
        Save as
      </Button>

      <Button variant="outline" size="sm" disabled={saving || !current} onClick={() => openNamePrompt('duplicate')}>
        <Copy className="mr-1.5 h-4 w-4" /> Duplicate
      </Button>

      <Button
        variant="ghost" size="sm" disabled={!current?._id}
        onClick={() => setConfirmDelete(true)}
      >
        <Trash2 className="mr-1.5 h-4 w-4 text-destructive" /> Delete
      </Button>

      <Dialog open={namePrompt !== null} onOpenChange={(open) => !open && setNamePrompt(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{namePrompt ? NAME_PROMPT_TITLE[namePrompt] : ''}</DialogTitle>
            <DialogDescription>Give this design a name.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="wristband-design-name">Name</Label>
          <Input
            id="wristband-design-name" value={nameValue} autoFocus
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmNamePrompt(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNamePrompt(null)}>Cancel</Button>
            <Button onClick={confirmNamePrompt} disabled={createMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this design?"
        description={`"${current?.name ?? ''}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => current?._id && deleteMutation.mutate(current._id)}
      />
    </div>
  );
}

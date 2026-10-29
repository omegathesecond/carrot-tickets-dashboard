import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import type { FanQuestion } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function FanQuestionEditor({ eventId, settings }: { eventId: string; settings: FanQuestion[] }) {
  const [draft, setDraft] = useState<FanQuestion[] | null>(null);
  const questions = draft ?? settings;
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => apiClient.vote.saveQuestions(eventId, questions),
    onSuccess: (preview) => {
      client.setQueryData(['votePreview', eventId], preview);
      client.invalidateQueries({ queryKey: ['voteSummary', eventId] });
      setDraft(null);
      toast.success('Fan questions saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const update = (index: number, change: Partial<FanQuestion>) => setDraft(questions.map((q, i) => i === index ? { ...q, ...change } : q));
  return (
    <Card>
      <CardHeader><CardTitle>Questions for your fans</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-slate-500">Choose which questions fans see in this event’s attendance section. Edit the defaults or add your own. Save to apply your changes.</p>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
          <fieldset disabled={save.isPending} className="space-y-4">
            {questions.map((q, index) => (
              <div key={q.kind} className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={q.enabled} onChange={e => update(index, { enabled: e.target.checked })} /> Show to fans
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(questions.filter((_, i) => i !== index))} aria-label={`Delete question ${index + 1}`}>Delete question</Button>
                </div>
                <label className="block text-sm">Question {index + 1}
                  <Input className="mt-1" required maxLength={200} value={q.prompt} onChange={e => update(index, { prompt: e.target.value })} />
                </label>
                {q.kind === 'song' ? <p className="text-xs text-slate-500">Fans suggest songs for this question.</p> : (
                  <div className="space-y-2">
                    {q.options.map((option, oi) => (
                      <div key={option.key} className="flex items-end gap-2">
                        <label className="flex-1 text-xs text-slate-600">Answer {oi + 1}
                          <Input className="mt-1" required maxLength={120} value={option.label} onChange={e => update(index, { options: q.options.map((o, i) => i === oi ? { ...o, label: e.target.value } : o) })} />
                        </label>
                        <Button type="button" variant="ghost" size="sm" disabled={q.options.length <= 2} aria-label={`Remove answer ${oi + 1} from question ${index + 1}`} onClick={() => update(index, { options: q.options.filter((_, i) => i !== oi) })}>Remove</Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" disabled={q.options.length >= 30} onClick={() => update(index, { options: [...q.options, { key: crypto.randomUUID(), label: '' }] })}>Add answer</Button>
                  </div>
                )}
              </div>
            ))}
            {questions.length === 0 && <p className="text-sm text-slate-500">No questions selected. Add a question to ask your fans.</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={questions.length >= 30} onClick={() => setDraft([...questions, { kind: `custom_${crypto.randomUUID()}`, prompt: '', enabled: true, options: [{ key: crypto.randomUUID(), label: '' }, { key: crypto.randomUUID(), label: '' }] }])}>Add question</Button>
              <Button type="submit" disabled={draft === null}>{save.isPending ? 'Saving…' : 'Save questions'}</Button>
              {draft !== null && <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Discard changes</Button>}
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, TicketsPermission } from '@/lib/permissions';
import { ClipboardCheck as AttendanceStatusIcon, Clock, CheckCircle2, MessageSquare, Music, Trash2, Crown, CupSoda } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { VoteQuestionKind, VoteResultOption, VoteComment } from '@/types';

interface EventVoteTabProps {
  eventId: string;
}

const KIND_LABEL: Record<VoteQuestionKind, string> = {
  attending_with: 'Attending With',
  busy: 'Crowd',
  bump_into: 'Bump Into',
  cup: 'Relationship Status',
  artist: 'Artist',
  song: 'Song',
  outfit: 'Outfit Theme',
};

// "Choose Your Cup" color indicator (spec §1 Q5) — always shown alongside,
// never instead of, the written relationship status.
const CUP_COLOR_CLASS: Record<string, string> = { green: 'text-emerald-500', yellow: 'text-amber-500', red: 'text-red-500' };

function ResultBar({ option, isLeading, cupColor }: { option: VoteResultOption; isLeading: boolean; cupColor?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="flex items-center gap-1.5 font-medium text-slate-900">
          {cupColor && <CupSoda className={`h-3.5 w-3.5 ${CUP_COLOR_CLASS[cupColor] ?? 'text-slate-400'}`} />}
          {option.label}
          {isLeading && option.count > 0 && <Crown className="h-3.5 w-3.5 text-amber-500" />}
        </span>
        <span className="text-slate-600">
          {option.count} · {option.percent}%
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-orange-600 to-amber-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${option.percent}%` }}
        />
      </div>
    </div>
  );
}

function CommentRow({ comment, canModerate, onRemove }: { comment: VoteComment; canModerate: boolean; onRemove: (id: string) => void }) {
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={comment.author.avatarUrl ?? undefined} />
        <AvatarFallback>{(comment.author.name ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">
            {comment.author.name ?? comment.author.username ?? 'Someone'}
          </span>
          {comment.author.type === 'organizer' && (
            <Badge variant="outline" className="text-[10px] py-0">Organizer</Badge>
          )}
          <span className="text-xs text-slate-500">{format(new Date(comment.createdAt), 'PPp')}</span>
        </div>
        <p className="text-sm text-slate-800 break-words mt-0.5">{comment.body}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span>{comment.likeCount} like{comment.likeCount === 1 ? '' : 's'}</span>
          {canModerate && (
            <button
              type="button"
              onClick={() => onRemove(comment.id)}
              className="flex items-center gap-1 text-red-600 hover:underline"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
        {comment.replies.length > 0 && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-slate-100">
            {comment.replies.map((r) => (
              <CommentRow key={r.id} comment={r} canModerate={canModerate} onRemove={onRemove} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Organizer dashboard's Attendance Status area (spec §9): preview it before
 * it activates, genuine participation stats + results + song suggestions
 * once it's live, and discussion moderation — all strictly READ-ONLY against
 * response totals/selections/questions/options (there is no write endpoint
 * for any of that once responses have started, so there is nothing to
 * accidentally expose).
 */
export function EventVoteTab({ eventId }: EventVoteTabProps) {
  const { user } = useAuth();
  const canModerate = hasPermission(user, TicketsPermission.MANAGE_ACCESS);
  const queryClient = useQueryClient();

  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['votePreview', eventId],
    queryFn: () => apiClient.vote.getPreview(eventId),
    enabled: !!eventId,
  });

  const hasOpened = preview?.window.hasOpened ?? false;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['voteSummary', eventId],
    queryFn: () => apiClient.vote.getSummary(eventId),
    enabled: !!eventId && hasOpened,
  });

  useEffect(() => {
    if (!selectedQuestionId && summary?.questions?.length) {
      setSelectedQuestionId(summary.questions[0]!.id);
    }
  }, [summary, selectedQuestionId]);

  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['voteComments', selectedQuestionId],
    queryFn: () => apiClient.vote.getComments(selectedQuestionId!),
    enabled: !!selectedQuestionId,
  });

  const removeCommentMutation = useMutation({
    mutationFn: (commentId: string) => apiClient.vote.removeComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voteComments', selectedQuestionId] });
      toast.success('Comment removed');
      setRemoveTarget(null);
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove comment'),
  });

  if (previewLoading) {
    return <div className="p-8 text-center text-slate-500">Loading Attendance Status…</div>;
  }

  const window_ = summary?.window ?? preview?.window;

  return (
    <div className="space-y-6">
      {/* Window status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AttendanceStatusIcon className="h-5 w-5 text-orange-600" />
            Attendance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-slate-500">
            Attendance Status responses show users’ intentions and preferences only. They do not confirm ticket purchases or event entry.
          </p>
          {!window_?.opensAt ? (
            <p className="text-sm text-slate-600">
              Attendance Status activates automatically once this event is published — seven days before it starts,
              or immediately if you publish inside that final week.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <Badge
                variant={window_.hasClosed ? 'secondary' : window_.hasOpened ? 'default' : 'outline'}
                className={window_.hasOpened && !window_.hasClosed ? 'bg-gradient-to-r from-orange-600 to-amber-600' : ''}
              >
                {window_.hasClosed ? 'Closed — Response Results' : window_.hasOpened ? 'Open' : 'Not yet open'}
              </Badge>
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Clock className="h-4 w-4" />
                Opens {format(new Date(window_.opensAt), 'PPp')}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <CheckCircle2 className="h-4 w-4" />
                Closes {format(new Date(window_.closesAt), 'PPp')}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview (before activation) */}
      {!hasOpened && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">
              Based on this event's current details — not live yet. Keep refining the lineup / outfit
              theme options (on the event creation form) up until Attendance Status opens; questions and options are
              frozen the moment they go live and won't update after that.
            </p>
            {preview && preview.questions.length > 0 ? (
              preview.questions.map((q) => (
                <div key={q.kind} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{KIND_LABEL[q.kind]}</Badge>
                    <span className="font-medium text-slate-900">{q.prompt}</span>
                  </div>
                  {q.options.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {q.options.map((o) => (
                        <Badge key={o.key} variant="secondary">{o.label}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {q.kind === 'song' ? 'Attendees suggest songs once Attendance Status opens.' : 'No options yet.'}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No Attendance Status questions apply to this event yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results (once open) */}
      {hasOpened && (
        <>
          {summaryLoading ? (
            <div className="p-8 text-center text-slate-500">Loading results…</div>
          ) : summary && summary.questions.length > 0 ? (
            <div className="space-y-4">
              {summary.questions.map((q) => (
                <Card key={q.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Badge variant="outline">{KIND_LABEL[q.kind]}</Badge>
                        {q.prompt}
                      </CardTitle>
                      <span className="text-sm text-slate-600">{q.totalVotes} response{q.totalVotes === 1 ? '' : 's'}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {q.options.length > 0 ? (
                      <div className="space-y-3">
                        {q.options.map((o) => (
                          <ResultBar key={o.key} option={o} isLeading={o.key === q.leadingKey} cupColor={q.kind === 'cup' ? o.key : undefined} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No responses yet.</p>
                    )}

                    {q.kind === 'song' && q.songSuggestions && q.songSuggestions.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900 mb-2">
                          <Music className="h-4 w-4" /> Song Suggestions
                        </div>
                        <div className="space-y-1.5">
                          {q.songSuggestions.map((s) => (
                            <div key={s.id} className="flex items-center justify-between text-sm text-slate-700">
                              <span>{s.artist ? `${s.title} — ${s.artist}` : s.title}</span>
                              <span className="text-slate-500 text-xs">
                                {s.count} vote{s.count === 1 ? '' : 's'} · suggested {format(new Date(s.suggestedAt), 'PP')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                No Attendance Status questions apply to this event.
              </CardContent>
            </Card>
          )}

          {/* Discussion moderation */}
          {summary && summary.questions.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-orange-600" />
                    Discussion
                  </CardTitle>
                  <Select value={selectedQuestionId ?? undefined} onValueChange={setSelectedQuestionId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Choose a question" />
                    </SelectTrigger>
                    <SelectContent>
                      {summary.questions.map((q) => (
                        <SelectItem key={q.id} value={q.id}>{q.prompt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {commentsLoading ? (
                  <div className="py-6 text-center text-slate-500 text-sm">Loading discussion…</div>
                ) : commentsData && commentsData.comments.length > 0 ? (
                  <div className="space-y-5">
                    {commentsData.comments.map((c) => (
                      <CommentRow key={c.id} comment={c} canModerate={canModerate} onRemove={setRemoveTarget} />
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-slate-500">No comments yet on this question.</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove this comment?"
        description="It will be hidden from the Attendance Status discussion. This cannot be undone."
        confirmLabel="Remove"
        isLoading={removeCommentMutation.isPending}
        onConfirm={() => removeTarget && removeCommentMutation.mutate(removeTarget)}
      />
    </div>
  );
}

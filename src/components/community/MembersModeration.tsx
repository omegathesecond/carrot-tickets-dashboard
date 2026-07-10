import { useState } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Users, ShieldCheck, VolumeX, Ban as BanIcon, MoreHorizontal } from 'lucide-react';
import { apiClient, type AdminMemberView } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const PAGE_SIZE = 25;
const MUTE_MIN_MINUTES = 5;
const MUTE_MAX_MINUTES = 10080; // 7 days, matches api's muteSchema

const initialsOf = (label: string) =>
  label
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

function isCurrentlyMuted(member: AdminMemberView): boolean {
  return !!member.mutedUntil && new Date(member.mutedUntil).getTime() > Date.now();
}

/**
 * Organizer moderation roster for an event's community: mute/unmute,
 * ban/unban, and ticket-verification status per member. Reads the
 * communityId off the shared ['community-channels', eventId] query (the
 * channels list endpoint is the only admin route that returns it — see
 * api.ts's community.listChannels comment) so this never issues a second,
 * redundant fetch when ChannelsManager is mounted alongside it.
 */
export function MembersModeration({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [muteTarget, setMuteTarget] = useState<AdminMemberView | null>(null);
  const [muteMinutesInput, setMuteMinutesInput] = useState('60');
  const [banTarget, setBanTarget] = useState<AdminMemberView | null>(null);

  const { data: channelsData } = useQuery({
    queryKey: ['community-channels', eventId],
    queryFn: () => apiClient.community.listChannels(eventId),
    enabled: !!eventId,
  });
  const communityId = channelsData?.communityId;

  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['community-members', communityId],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiClient.community.listMembers(communityId!, { before: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1]?.cursor : undefined,
    enabled: !!communityId,
  });

  const members = data?.pages.flat() ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['community-members', communityId] });

  const muteMutation = useMutation({
    mutationFn: ({ buyerId, minutes }: { buyerId: string; minutes: number }) =>
      apiClient.community.muteMember(communityId!, buyerId, minutes),
    onSuccess: () => {
      invalidate();
      toast.success('Member muted');
      setMuteTarget(null);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Failed to mute member'),
  });

  const unmuteMutation = useMutation({
    mutationFn: (buyerId: string) => apiClient.community.unmuteMember(communityId!, buyerId),
    onSuccess: () => {
      invalidate();
      toast.success('Member unmuted');
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Failed to unmute member'),
  });

  const banMutation = useMutation({
    mutationFn: (buyerId: string) => apiClient.community.banMember(communityId!, buyerId),
    onSuccess: () => {
      invalidate();
      toast.success('Member banned');
      setBanTarget(null);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Failed to ban member'),
  });

  const unbanMutation = useMutation({
    mutationFn: (buyerId: string) => apiClient.community.unbanMember(communityId!, buyerId),
    onSuccess: () => {
      invalidate();
      toast.success('Member unbanned');
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Failed to unban member'),
  });

  const anyModerationPending =
    muteMutation.isPending || unmuteMutation.isPending || banMutation.isPending || unbanMutation.isPending;

  const submitCustomMute = () => {
    if (!muteTarget) return;
    const minutes = Number(muteMinutesInput);
    if (!Number.isInteger(minutes) || minutes < MUTE_MIN_MINUTES || minutes > MUTE_MAX_MINUTES) {
      toast.error(`Enter a whole number of minutes between ${MUTE_MIN_MINUTES} and ${MUTE_MAX_MINUTES}`);
      return;
    }
    muteMutation.mutate({ buyerId: muteTarget.id, minutes });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Members
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-slate-500">Loading members…</div>
        ) : members.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No members have joined this community yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const muted = isCurrentlyMuted(member);
                  const banned = !!member.bannedAt;
                  const label = member.name || member.username || 'Unknown buyer';
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{initialsOf(label)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{label}</div>
                            {member.username && (
                              <div className="text-xs text-slate-500">@{member.username}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.ticketVerified ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            <ShieldCheck className="h-3 w-3 mr-1" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Unverified</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {banned && (
                            <Badge variant="destructive" className="w-fit">
                              <BanIcon className="h-3 w-3 mr-1" /> Banned
                            </Badge>
                          )}
                          {muted && (
                            <Badge variant="secondary" className="w-fit">
                              <VolumeX className="h-3 w-3 mr-1" />
                              Muted until {format(new Date(member.mutedUntil as string), 'PP p')}
                            </Badge>
                          )}
                          {!banned && !muted && <span className="text-xs text-slate-500">Active</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {format(new Date(member.joinedAt), 'PP')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={anyModerationPending}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!banned && (
                              <>
                                <DropdownMenuLabel>Mute</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => muteMutation.mutate({ buyerId: member.id, minutes: 15 })}
                                >
                                  15 minutes
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => muteMutation.mutate({ buyerId: member.id, minutes: 60 })}
                                >
                                  1 hour
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => muteMutation.mutate({ buyerId: member.id, minutes: 1440 })}
                                >
                                  24 hours
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setMuteMinutesInput('60');
                                    setMuteTarget(member);
                                  }}
                                >
                                  Custom…
                                </DropdownMenuItem>
                                {muted && (
                                  <DropdownMenuItem onClick={() => unmuteMutation.mutate(member.id)}>
                                    Unmute
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {banned ? (
                              <DropdownMenuItem onClick={() => unbanMutation.mutate(member.id)}>
                                Unban
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => setBanTarget(member)}
                              >
                                Ban
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </CardContent>

      {/* Custom mute duration dialog */}
      <Dialog open={!!muteTarget} onOpenChange={(open) => !open && setMuteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mute {muteTarget?.name || muteTarget?.username || 'member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="mute-minutes">Minutes ({MUTE_MIN_MINUTES}–{MUTE_MAX_MINUTES})</Label>
            <Input
              id="mute-minutes"
              type="number"
              min={MUTE_MIN_MINUTES}
              max={MUTE_MAX_MINUTES}
              value={muteMinutesInput}
              onChange={(e) => setMuteMinutesInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMuteTarget(null)} disabled={muteMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitCustomMute} disabled={muteMutation.isPending}>
              {muteMutation.isPending ? 'Muting…' : 'Mute member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban confirmation */}
      <ConfirmDialog
        open={!!banTarget}
        onOpenChange={(open) => !open && setBanTarget(null)}
        title={`Ban ${banTarget?.name || banTarget?.username || 'this member'}?`}
        description="They lose access to this event's community — channels, DMs, and reactions — until unbanned."
        confirmLabel="Ban member"
        isLoading={banMutation.isPending}
        onConfirm={() => banTarget && banMutation.mutate(banTarget.id)}
      />
    </Card>
  );
}

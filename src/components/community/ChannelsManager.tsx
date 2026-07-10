import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Hash, Plus } from 'lucide-react';
import { apiClient, type ChannelAdminView, type ChannelPostPolicy } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const createChannelSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40, 'Max 40 characters'),
  gated: z.boolean(),
  postPolicy: z.enum(['all', 'organizer']),
});

type CreateChannelForm = z.infer<typeof createChannelSchema>;

const DEFAULT_FORM: CreateChannelForm = { name: '', gated: false, postPolicy: 'all' };

/**
 * Organizer channel management for an event's community: list every channel
 * (incl. archived), toggle gated/postPolicy/archived inline, and create new
 * channels. Default channels (#announcements/#general/#attendees) can have
 * gated/postPolicy toggled like any other channel — the API only blocks
 * RENAME and ARCHIVE on them (see channelAdmin.service.ts's isDefault guard),
 * so only the Archived switch is disabled for those rows.
 */
export function ChannelsManager({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['community-channels', eventId],
    queryFn: () => apiClient.community.listChannels(eventId),
    enabled: !!eventId,
  });

  const channels = data?.channels ?? [];

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateChannelForm>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: DEFAULT_FORM,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['community-channels', eventId] });

  const createChannel = useMutation({
    mutationFn: (values: CreateChannelForm) => apiClient.community.createChannel(eventId, values),
    onSuccess: () => {
      invalidate();
      toast.success('Channel created');
      setCreateOpen(false);
      reset(DEFAULT_FORM);
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Failed to create channel'),
  });

  const updateChannel = useMutation({
    mutationFn: ({
      channelId,
      patch,
    }: {
      channelId: string;
      patch: Partial<Pick<ChannelAdminView, 'gated' | 'postPolicy' | 'archived'>>;
    }) => apiClient.community.updateChannel(channelId, patch),
    onSuccess: () => {
      invalidate();
      toast.success('Channel updated');
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Failed to update channel'),
  });

  const onSubmit = (values: CreateChannelForm) => createChannel.mutate(values);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" /> Channels
        </CardTitle>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) reset(DEFAULT_FORM);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="bg-gradient-to-r from-orange-600 to-amber-600">
              <Plus className="h-4 w-4 mr-2" /> New Channel
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>New channel</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="channel-name">Name</Label>
                <Input id="channel-name" placeholder="e.g. vip-lounge" {...register('name')} />
                {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="channel-gated">Ticket-holders only</Label>
                  <p className="text-xs text-slate-500">Readable and writable only by verified ticket holders</p>
                </div>
                <Controller
                  control={control}
                  name="gated"
                  render={({ field }) => (
                    <Switch id="channel-gated" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel-post-policy">Who can post</Label>
                <Controller
                  control={control}
                  name="postPolicy"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="channel-post-policy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Everyone</SelectItem>
                        <SelectItem value="organizer">Organizer only (read-only for buyers)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createChannel.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createChannel.isPending}>
                  {createChannel.isPending ? 'Creating…' : 'Create channel'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-slate-500">Loading channels…</div>
        ) : channels.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No channels yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Ticket-holders only</TableHead>
                  <TableHead>Who can post</TableHead>
                  <TableHead>Archived</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-1.5">
                        # {channel.name}
                        {channel.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">/{channel.slug}</div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={channel.gated}
                        disabled={updateChannel.isPending}
                        onCheckedChange={(checked) =>
                          updateChannel.mutate({ channelId: channel.id, patch: { gated: checked } })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={channel.postPolicy}
                        disabled={updateChannel.isPending}
                        onValueChange={(value) =>
                          updateChannel.mutate({
                            channelId: channel.id,
                            patch: { postPolicy: value as ChannelPostPolicy },
                          })
                        }
                      >
                        <SelectTrigger className="w-[190px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Everyone</SelectItem>
                          <SelectItem value="organizer">Organizer only</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span title={channel.isDefault ? "Default channels can't be archived" : undefined}>
                        <Switch
                          checked={channel.archived}
                          disabled={channel.isDefault || updateChannel.isPending}
                          onCheckedChange={(checked) =>
                            updateChannel.mutate({ channelId: channel.id, patch: { archived: checked } })
                          }
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

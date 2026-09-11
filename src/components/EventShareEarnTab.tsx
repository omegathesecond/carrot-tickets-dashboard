import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { currencySymbol, formatMoney } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { StatsCard } from '@/components/ui/stats-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, TicketsPermission } from '@/lib/permissions';
import {
  Gift, Users, MousePointerClick, Eye, Ticket, DollarSign, Clock, TrendingUp,
  Wallet, Trophy, Plus, Trash2, Download, Flag, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type {
  Event, ShareEarnCampaign, ShareEarnRewardRule, ShareEarnRewardType, ShareEarnRewardTriggerKind,
  ShareEarnRewardProvider, ShareEarnFlaggedReferral,
} from '@/types';

interface EventShareEarnTabProps {
  eventId: string;
  event: Event;
}

const REWARD_TYPE_LABEL: Record<ShareEarnRewardType, string> = {
  points: 'Carrot points',
  ticket_discount: 'Ticket discount',
  free_ticket: 'Free ticket',
  upgrade: 'VIP / ticket upgrade',
  voucher: 'Food or beverage voucher',
  merchandise: 'Merchandise',
  benefit: 'Special event benefit',
};

const TRIGGER_LABEL: Record<ShareEarnRewardTriggerKind, string> = {
  per_sale: 'Per confirmed sale',
  milestone: 'Sales milestone',
  top_promoter: 'Top promoter',
};

let ruleKeySeq = 0;
function newDraftRule(): ShareEarnRewardRule & { _key: string } {
  ruleKeySeq += 1;
  return {
    _key: `new-${ruleKeySeq}`,
    ruleId: '',
    trigger: 'per_sale',
    rewardType: 'points',
    provider: 'carrot',
    pointsAmount: 10,
  };
}

function describeRule(rule: ShareEarnRewardRule, symbol: string): string {
  const reward =
    rule.rewardType === 'points'
      ? `${rule.pointsAmount ?? 0} points`
      : rule.description || REWARD_TYPE_LABEL[rule.rewardType];
  const trigger =
    rule.trigger === 'per_sale'
      ? 'per confirmed sale'
      : rule.trigger === 'milestone'
        ? `after ${rule.milestoneSalesCount ?? 0} confirmed sales`
        : 'for the top promoter';
  const cost = rule.costValue ? ` (${symbol}${rule.costValue} budget cost)` : '';
  return `${reward} ${trigger}${cost}`;
}

/**
 * Organizer dashboard's Share&Earn area (spec §1/§10): configure/preview/
 * activate a campaign's reward structure, monitor its live stats, review
 * flagged referrals, and export the promoter report. The campaign-config
 * form stays editable even once active — the API enforces "never reduce a
 * reward already earned" (spec §1) server-side; this UI just surfaces
 * whatever it rejects.
 */
export function EventShareEarnTab({ eventId, event }: EventShareEarnTabProps) {
  const { user } = useAuth();
  const canEdit = hasPermission(user, TicketsPermission.EDIT_EVENT);
  const canModerate = hasPermission(user, TicketsPermission.MANAGE_ACCESS);
  const queryClient = useQueryClient();
  const symbol = currencySymbol(event.currency);

  const { data: campaignData, isLoading: campaignLoading } = useQuery({
    queryKey: ['shareEarnCampaign', eventId],
    queryFn: () => apiClient.shareEarn.getCampaign(eventId),
    enabled: !!eventId,
  });
  const campaign = campaignData?.campaign ?? null;
  const isLive = campaign && campaign.status !== 'draft';

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['shareEarnDashboard', eventId],
    queryFn: () => apiClient.shareEarn.getDashboard(eventId),
    enabled: !!eventId && !!isLive,
  });

  const { data: promotersPage } = useQuery({
    queryKey: ['shareEarnPromoters', eventId],
    queryFn: () => apiClient.shareEarn.getPromoters(eventId, 1, 100),
    enabled: !!eventId && !!isLive,
  });

  const { data: flaggedData } = useQuery({
    queryKey: ['shareEarnFlagged', eventId],
    queryFn: () => apiClient.shareEarn.getFlaggedReferrals(eventId),
    enabled: !!eventId && !!isLive && canModerate,
  });

  // ── Draft form state, seeded from the loaded campaign (or sane defaults) ──
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [eligibleTicketTypeIds, setEligibleTicketTypeIds] = useState<string[]>([]);
  const [rules, setRules] = useState<Array<ShareEarnRewardRule & { _key: string }>>([]);
  const [maxPromoters, setMaxPromoters] = useState('');
  const [maxRewardBudget, setMaxRewardBudget] = useState('');
  const [allowSelfReferral, setAllowSelfReferral] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [requirePromoterApproval, setRequirePromoterApproval] = useState(false);
  const [terms, setTerms] = useState('');
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (seeded || campaignLoading) return;
    if (campaign) {
      setStartsAt(campaign.startsAt.slice(0, 16));
      setEndsAt(campaign.endsAt.slice(0, 16));
      setEligibleTicketTypeIds(campaign.eligibleTicketTypeIds);
      setRules(campaign.rewardRules.map((r) => ({ ...r, _key: r.ruleId })));
      setMaxPromoters(campaign.maxPromoters != null ? String(campaign.maxPromoters) : '');
      setMaxRewardBudget(campaign.maxRewardBudget != null ? String(campaign.maxRewardBudget) : '');
      setAllowSelfReferral(campaign.allowSelfReferral);
      setShowLeaderboard(campaign.showLeaderboard);
      setRequirePromoterApproval(campaign.requirePromoterApproval);
      setTerms(campaign.terms ?? '');
    } else {
      const now = new Date();
      const eventEnd = event.endTime ? new Date(event.endTime) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      setStartsAt(now.toISOString().slice(0, 16));
      setEndsAt(eventEnd.toISOString().slice(0, 16));
      setRules([newDraftRule()]);
    }
    setSeeded(true);
  }, [campaign, campaignLoading, seeded, event.endTime]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.shareEarn.saveCampaign(eventId, {
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        eligibleTicketTypeIds,
        rewardRules: rules.map(({ _key, ruleId, ...r }) => (ruleId ? { ruleId, ...r } : r)),
        maxPromoters: maxPromoters ? Number(maxPromoters) : null,
        maxRewardBudget: maxRewardBudget ? Number(maxRewardBudget) : null,
        allowSelfReferral,
        showLeaderboard,
        requirePromoterApproval,
        terms: terms || undefined,
      }),
    onSuccess: (res) => {
      toast.success('Share&Earn configuration saved');
      queryClient.setQueryData(['shareEarnCampaign', eventId], { campaign: res.campaign });
      setRules(res.campaign.rewardRules.map((r) => ({ ...r, _key: r.ruleId })));
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save Share&Earn configuration'),
  });

  const [confirmActivate, setConfirmActivate] = useState(false);
  const activateMutation = useMutation({
    mutationFn: () => apiClient.shareEarn.activate(eventId),
    onSuccess: (res) => {
      toast.success('Share&Earn is live');
      queryClient.setQueryData(['shareEarnCampaign', eventId], { campaign: res.campaign });
      setConfirmActivate(false);
    },
    onError: (error: Error) => { toast.error(error.message || 'Failed to activate Share&Earn'); setConfirmActivate(false); },
  });

  const pauseMutation = useMutation({
    mutationFn: () => apiClient.shareEarn.pause(eventId),
    onSuccess: (res) => { toast.success('Share&Earn paused'); queryClient.setQueryData(['shareEarnCampaign', eventId], { campaign: res.campaign }); },
    onError: (error: Error) => toast.error(error.message || 'Failed to pause Share&Earn'),
  });

  const [confirmClose, setConfirmClose] = useState(false);
  const closeMutation = useMutation({
    mutationFn: () => apiClient.shareEarn.close(eventId),
    onSuccess: (res) => {
      toast.success('Share&Earn closed');
      queryClient.setQueryData(['shareEarnCampaign', eventId], { campaign: res.campaign });
      setConfirmClose(false);
    },
    onError: (error: Error) => { toast.error(error.message || 'Failed to close Share&Earn'); setConfirmClose(false); },
  });

  const toggleRegistrationsMutation = useMutation({
    mutationFn: () => apiClient.shareEarn.setRegistrationsPaused(eventId, !campaign?.registrationsPaused),
    onSuccess: (res) => {
      toast.success(res.campaign.registrationsPaused ? 'New promoter registrations paused' : 'Promoter registrations resumed');
      queryClient.setQueryData(['shareEarnCampaign', eventId], { campaign: res.campaign });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update registrations'),
  });

  const [reviewTarget, setReviewTarget] = useState<ShareEarnFlaggedReferral | null>(null);
  const [disqualifyReason, setDisqualifyReason] = useState('');
  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'disqualify') =>
      apiClient.shareEarn.reviewReferral(eventId, reviewTarget!.id, action, action === 'disqualify' ? disqualifyReason : undefined),
    onSuccess: () => {
      toast.success('Referral reviewed');
      queryClient.invalidateQueries({ queryKey: ['shareEarnFlagged', eventId] });
      queryClient.invalidateQueries({ queryKey: ['shareEarnDashboard', eventId] });
      setReviewTarget(null);
      setDisqualifyReason('');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to review referral'),
  });

  const updateRule = (key: string, patch: Partial<ShareEarnRewardRule>) => {
    setRules((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  };
  const removeRule = (key: string) => setRules((prev) => prev.filter((r) => r._key !== key));
  const addRule = () => setRules((prev) => [...prev, newDraftRule()]);

  const canActivate = !!campaign && campaign.status === 'draft' && rules.length > 0;

  if (campaignLoading || !seeded) {
    return <div className="p-8 text-center text-slate-500">Loading Share&Earn…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-orange-600" />
              Share&amp;Earn
            </CardTitle>
            <div className="flex items-center gap-2">
              {campaign && (
                <Badge
                  variant={campaign.status === 'closed' ? 'secondary' : campaign.status === 'active' ? 'default' : 'outline'}
                  className={campaign.status === 'active' ? 'bg-gradient-to-r from-orange-600 to-amber-600' : ''}
                >
                  {campaign.status === 'draft' ? 'Not activated' : campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                </Badge>
              )}
              {canEdit && campaign?.status === 'active' && (
                <Button size="sm" variant="outline" onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending}>
                  Pause campaign
                </Button>
              )}
              {canEdit && campaign?.status === 'paused' && (
                <Button size="sm" onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}>
                  Resume campaign
                </Button>
              )}
              {canEdit && isLive && campaign?.status !== 'closed' && (
                <Button size="sm" variant="outline" onClick={() => toggleRegistrationsMutation.mutate()} disabled={toggleRegistrationsMutation.isPending}>
                  {campaign?.registrationsPaused ? 'Resume new promoters' : 'Pause new promoters'}
                </Button>
              )}
              {canEdit && isLive && campaign?.status !== 'closed' && (
                <Button size="sm" variant="destructive" onClick={() => setConfirmClose(true)}>
                  Close campaign
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {!campaign && (
          <CardContent>
            <p className="text-sm text-slate-600">
              Share&amp;Earn lets registered Carrot users share this event's ticket link and earn points, tickets or
              other rewards for confirmed sales they personally refer — no cash, no commissions. Configure the reward
              structure below, then preview and activate when you're ready.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Live dashboard */}
      {isLive && (
        <>
          {dashboardLoading || !dashboard ? (
            <div className="p-8 text-center text-slate-500">Loading dashboard…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatsCard title="Promoters" value={dashboard.registeredPromoters} description="Registered promoters" icon={Users} gradient="from-orange-500 to-amber-500" />
                <StatsCard title="Link Clicks" value={dashboard.linkClicks} description={`${dashboard.uniqueVisitors} unique visitors`} icon={MousePointerClick} gradient="from-blue-500 to-blue-600" />
                <StatsCard title="Tickets Sold" value={dashboard.ticketSalesGenerated} description="Via referrals" icon={Ticket} gradient="from-emerald-500 to-emerald-600" />
                <StatsCard title="Revenue Generated" value={formatMoney(dashboard.revenueGenerated, event.currency as any)} description="From referred sales" icon={DollarSign} gradient="from-violet-500 to-violet-600" />
                <StatsCard title="Conversion Rate" value={`${dashboard.conversionRate}%`} description="Clicks → confirmed sales" icon={TrendingUp} gradient="from-cyan-500 to-cyan-600" />
                <StatsCard title="Reward Cost" value={formatMoney(dashboard.totalCampaignRewardCost, event.currency as any)} description="Pending + confirmed + redeemed" icon={Wallet} gradient="from-rose-500 to-rose-600" />
                <StatsCard
                  title="Remaining Budget"
                  value={dashboard.remainingRewardBudget != null ? formatMoney(dashboard.remainingRewardBudget, event.currency as any) : 'Unlimited'}
                  description="Against the reward budget cap"
                  icon={Wallet}
                  gradient="from-amber-500 to-orange-600"
                />
                <StatsCard title="Rewards" value={`${dashboard.pendingRewards} / ${dashboard.confirmedRewards} / ${dashboard.redeemedRewards}`} description="Pending / confirmed / redeemed" icon={Gift} gradient="from-pink-500 to-rose-600" />
              </div>

              {dashboard.topPromoters.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-amber-500" /> Top Promoters</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dashboard.topPromoters.map((p, idx) => (
                        <div key={p.promoterId} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                          <span className="flex items-center gap-2">
                            <span className="text-slate-400 w-5">#{idx + 1}</span>
                            <span className="font-medium text-slate-900">{p.buyer?.name ?? p.buyer?.username ?? 'Promoter'}</span>
                          </span>
                          <span className="text-slate-600">{p.confirmedSalesCount} sale{p.confirmedSalesCount === 1 ? '' : 's'} · {p.ticketsSoldCount} ticket{p.ticketsSoldCount === 1 ? '' : 's'}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Promoters</CardTitle>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => apiClient.shareEarn.exportCsv(eventId, event.name).catch((e) => toast.error(e.message || 'Export failed'))}>
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {promotersPage && promotersPage.promoters.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Promoter</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                            <TableHead className="text-right">Sales</TableHead>
                            <TableHead className="text-right">Tickets</TableHead>
                            <TableHead className="text-right">Rewards (P/C/R)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {promotersPage.promoters.map((p) => (
                            <TableRow key={p.promoterId}>
                              <TableCell>{p.buyer?.name ?? p.buyer?.username ?? '—'}</TableCell>
                              <TableCell><Badge variant="outline">{p.status.replace('_', ' ')}</Badge></TableCell>
                              <TableCell className="text-right">{p.clicks}</TableCell>
                              <TableCell className="text-right">{p.confirmedSalesCount}</TableCell>
                              <TableCell className="text-right">{p.ticketsSoldCount}</TableCell>
                              <TableCell className="text-right">{p.pendingRewardsCount} / {p.confirmedRewardsCount} / {p.redeemedRewardsCount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 py-4 text-center">No promoters have joined yet.</p>
                  )}
                </CardContent>
              </Card>

              {canModerate && flaggedData && flaggedData.referrals.length > 0 && (
                <Card className="border-amber-200">
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base text-amber-700"><Flag className="h-4 w-4" /> Flagged Referrals — Need Review</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {flaggedData.referrals.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                        <div className="text-sm">
                          <p className="font-medium text-slate-900">
                            {r.promoter?.buyerName ?? 'A promoter'} referred {r.referredBuyer?.name ?? 'a buyer'}
                          </p>
                          <p className="text-xs text-amber-700 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3" /> {r.flaggedReason ?? 'Flagged for review'}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setReviewTarget(r)}>Review</Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Campaign configuration */}
      {canEdit && campaign?.status !== 'closed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{campaign ? 'Campaign Settings' : 'Set Up Share&Earn'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLive && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Once live, rewards already earned by promoters can only be raised or added to — never reduced or removed.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Campaign starts</Label>
                <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <Label>Campaign closes</Label>
                <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Eligible ticket types</Label>
              <p className="text-xs text-slate-500 mb-2">Leave all unchecked to make every ticket type eligible.</p>
              <div className="flex flex-wrap gap-3">
                {event.ticketTypes.map((tt) => (
                  <label key={tt._id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={eligibleTicketTypeIds.includes(tt._id)}
                      onCheckedChange={(checked) =>
                        setEligibleTicketTypeIds((prev) => (checked ? [...prev, tt._id] : prev.filter((id) => id !== tt._id)))
                      }
                    />
                    {tt.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Rewards</Label>
                <Button type="button" size="sm" variant="outline" onClick={addRule}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add reward
                </Button>
              </div>
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div key={rule._key} className="rounded-lg border border-slate-200 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 flex-1">{describeRule(rule, symbol)}</p>
                      <button type="button" onClick={() => removeRule(rule._key)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">When earned</Label>
                        <Select value={rule.trigger} onValueChange={(v: ShareEarnRewardTriggerKind) => updateRule(rule._key, { trigger: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TRIGGER_LABEL) as ShareEarnRewardTriggerKind[]).map((k) => (
                              <SelectItem key={k} value={k}>{TRIGGER_LABEL[k]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {rule.trigger === 'milestone' && (
                        <div>
                          <Label className="text-xs">Sales milestone (count)</Label>
                          <Input type="number" min={1} value={rule.milestoneSalesCount ?? ''} onChange={(e) => updateRule(rule._key, { milestoneSalesCount: Number(e.target.value) })} />
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">Reward type</Label>
                        <Select value={rule.rewardType} onValueChange={(v: ShareEarnRewardType) => updateRule(rule._key, { rewardType: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(REWARD_TYPE_LABEL) as ShareEarnRewardType[]).map((k) => (
                              <SelectItem key={k} value={k}>{REWARD_TYPE_LABEL[k]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Provided by</Label>
                        <Select value={rule.provider} onValueChange={(v: ShareEarnRewardProvider) => updateRule(rule._key, { provider: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="carrot">Carrot</SelectItem>
                            <SelectItem value="organizer">Organizer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {rule.rewardType === 'points' ? (
                      <div className="max-w-[200px]">
                        <Label className="text-xs">Points per sale</Label>
                        <Input type="number" min={1} value={rule.pointsAmount ?? ''} onChange={(e) => updateRule(rule._key, { pointsAmount: Number(e.target.value) })} />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Reward description</Label>
                          <Input placeholder="e.g. Free VIP upgrade" value={rule.description ?? ''} onChange={(e) => updateRule(rule._key, { description: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Budget cost ({symbol}, optional)</Label>
                          <Input type="number" min={0} value={rule.costValue ?? ''} onChange={(e) => updateRule(rule._key, { costValue: Number(e.target.value) })} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {rules.length === 0 && <p className="text-sm text-slate-500">Add at least one reward before activating.</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Maximum promoters (optional)</Label>
                <Input type="number" min={1} placeholder="Unlimited" value={maxPromoters} onChange={(e) => setMaxPromoters(e.target.value)} />
              </div>
              <div>
                <Label>Maximum reward budget ({symbol}, optional)</Label>
                <Input type="number" min={0} placeholder="Unlimited" value={maxRewardBudget} onChange={(e) => setMaxRewardBudget(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow self-referral</Label>
                  <p className="text-xs text-slate-500">Let promoters earn from their own ticket purchases.</p>
                </div>
                <Switch checked={allowSelfReferral} onCheckedChange={setAllowSelfReferral} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Public promoter leaderboard</Label>
                  <p className="text-xs text-slate-500">Show a ranked leaderboard on the event page.</p>
                </div>
                <Switch checked={showLeaderboard} onCheckedChange={setShowLeaderboard} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require promoter approval</Label>
                  <p className="text-xs text-slate-500">Review each join request before someone can start sharing.</p>
                </div>
                <Switch checked={requirePromoterApproval} onCheckedChange={setRequirePromoterApproval} />
              </div>
            </div>

            <div>
              <Label>Campaign terms (optional)</Label>
              <Textarea rows={3} placeholder="Any terms specific to this event's Share&Earn campaign…" value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || rules.length === 0}>
                {campaign ? 'Save changes' : 'Save draft'}
              </Button>
              {!isLive && (
                <Button variant="default" className="bg-gradient-to-r from-orange-600 to-amber-600" onClick={() => setConfirmActivate(true)} disabled={!canActivate || activateMutation.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Preview &amp; Activate
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmActivate}
        onOpenChange={setConfirmActivate}
        title="Activate Share&Earn?"
        description={`This will make Share&Earn live for buyers on this event's page. Reward rules: ${rules.map((r) => describeRule(r, symbol)).join('; ') || 'none configured'}. Once activated, rewards already earned by promoters can never be reduced.`}
        confirmLabel="Activate"
        destructive={false}
        isLoading={activateMutation.isPending}
        onConfirm={() => activateMutation.mutate()}
      />

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close this Share&Earn campaign?"
        description="New referrals will stop immediately. Everything already tracked and earned is preserved, and pending rewards are still processed."
        confirmLabel="Close campaign"
        isLoading={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate()}
      />

      {/* Flagged referral review */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => { if (!open) { setReviewTarget(null); setDisqualifyReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review flagged referral</DialogTitle>
            <DialogDescription>{reviewTarget?.flaggedReason}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              {reviewTarget?.promoter?.buyerName ?? 'A promoter'} referred {reviewTarget?.referredBuyer?.name ?? 'a buyer'} —
              {' '}{reviewTarget?.eligibleTicketCount} ticket{reviewTarget?.eligibleTicketCount === 1 ? '' : 's'}, {formatMoney(reviewTarget?.eligibleSalesValue ?? 0, event.currency as any)}.
            </p>
            <div>
              <Label>Reason (required to disqualify)</Label>
              <Textarea rows={2} value={disqualifyReason} onChange={(e) => setDisqualifyReason(e.target.value)} placeholder="Recorded in the audit trail and visible if appealed" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => reviewMutation.mutate('approve')} disabled={reviewMutation.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
            </Button>
            <Button variant="destructive" onClick={() => reviewMutation.mutate('disqualify')} disabled={reviewMutation.isPending || !disqualifyReason.trim()}>
              <XCircle className="h-4 w-4 mr-1.5" /> Disqualify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

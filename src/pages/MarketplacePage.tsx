import { newOpportunity, certificateLabel } from '@/lib/marketplace';
import { useEffect, useState } from 'react';
import { apiClient as api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  OpportunityEditor,
  Field,
  control,
} from '@/components/marketplace/OpportunityEditor';
import type {
  Opportunity,
  MarketOptions,
  OrganiserApplication,
  Certificate,
} from '@/types/marketplace';
export function MarketplacePage() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [options, setOptions] = useState<MarketOptions>();
  const [editing, setEditing] = useState<Opportunity>();
  const [selected, setSelected] = useState('');
  const [review, setReview] = useState<{
    items: OrganiserApplication[];
    certificates: Certificate[];
  }>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const permitted = user?.userType === 'vendor';
  useEffect(() => {
    if (!permitted) return;
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api.marketplace<{ items: Opportunity[] }>('/manage/opportunities'),
      api.marketplace<MarketOptions>('/options'),
    ])
      .then(([data, opts]) => {
        if (active) {
          setOpportunities(data.items);
          setOptions(opts);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [permitted, retry]);
  useEffect(() => {
    setReview(undefined);
    if (!selected || !permitted) return;
    let active = true;
    api
      .marketplace<{
        items: OrganiserApplication[];
        certificates: Certificate[];
      }>(`/manage/opportunities/${selected}/applications`)
      .then((data) => {
        if (active) setReview(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [selected, permitted, retry]);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(message);
      setRetry((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Marketplace request failed.');
    } finally {
      setBusy(false);
    }
  }
  function save(value: Opportunity) {
    const { _id, organiser, status, ...body } = value;
    void organiser;
    void status;
    // Only send fields defined by the opportunity contract, excluding server metadata.
    const keys = [...Object.keys(newOpportunity(options!)), 'eventId', 'posterUrl'].filter(
      (k) => !['_id', 'organiser', 'status'].includes(k),
    );
    const payload = Object.fromEntries(
      keys.map((key) => [key, body[key as keyof typeof body]]),
    );
    action(async () => {
      await api.marketplace('/manage/opportunities' + (_id ? '/' + _id : ''), {
        method: _id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setEditing(undefined);
    }, 'Opportunity saved. Publish it when you’re ready.');
  }
  if (!permitted)
    return (
      <div className="p-6">
        Marketplace management is available to business account owners.
      </div>
    );
  const selectedOpportunity = opportunities.find((o) => o._id === selected);
  const groups = [...new Set(review?.items.map((a) => a.scopeKey) || [])];
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="mt-2 text-muted-foreground">
            Publish trading opportunities and review provider applications by
            date.
          </p>
        </div>
        <Button
          disabled={!options || busy}
          onClick={() => setEditing(newOpportunity(options!))}
        >
          Create opportunity
        </Button>
      </header>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive p-4 text-destructive"
        >
          {error}
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry loading
          </Button>
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-lg bg-muted p-3 text-sm">
          {notice}
        </p>
      ) : null}
      {editing && options ? (
        <OpportunityEditor
          key={editing._id || 'new'}
          initial={editing}
          options={options}
          busy={busy}
          onSave={save}
          onCancel={() => setEditing(undefined)}
        />
      ) : null}
      {loading && !opportunities.length ? (
        <p role="status">Loading opportunities…</p>
      ) : opportunities.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Create your first market opportunity to invite providers.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {opportunities.map((o) => (
            <article
              key={o._id}
              className="space-y-3 rounded-xl border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold">{o.name}</h2>
                <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
                  {o.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {o.organiser} · {o.location}
              </p>
              <p className="text-sm">
                {o.dates.join(' · ')} ·{' '}
                {o.scope === 'regular'
                  ? 'Regular traders'
                  : 'Applications per date'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setSelected(o._id)}
                >
                  Review applications
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || o.status === 'closed'}
                  onClick={() => setEditing(o)}
                >
                  Edit
                </Button>
                {o.status !== 'closed' ? (
                  <>
                    {o.status !== 'published' ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          action(
                            () =>
                              api.marketplace(
                                `/manage/opportunities/${o._id}/status`,
                                {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'published' }),
                                },
                              ),
                            'Opportunity published.',
                          )
                        }
                      >
                        Publish
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          action(
                            () =>
                              api.marketplace(
                                `/manage/opportunities/${o._id}/status`,
                                {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'paused' }),
                                },
                              ),
                            'New applications paused.',
                          )
                        }
                      >
                        Pause
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Close this opportunity? It cannot be reopened. Existing applications remain available for review.',
                          )
                        )
                          action(
                            () =>
                              api.marketplace(
                                `/manage/opportunities/${o._id}/status`,
                                {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'closed' }),
                                },
                              ),
                            'Opportunity closed.',
                          );
                      }}
                    >
                      Close
                    </Button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
      {selected ? (
        <section className="space-y-5 border-t pt-6">
          <h2 className="text-2xl font-bold">
            Applications · {selectedOpportunity?.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Application details and certificates are private. Payment status is
            recorded by the organiser after verifying payment; this screen does
            not collect payments.
          </p>
          {!review ? (
            <p role="status">Loading applications…</p>
          ) : !review.items.length ? (
            <p>No applications yet.</p>
          ) : (
            groups.map((scope) => (
              <div key={scope} className="space-y-3">
                <h3 className="font-bold">
                  {scope === 'regular' ? 'Regular traders' : scope} ·{' '}
                  {
                    review.items.filter(
                      (a) => a.scopeKey === scope && a.status === 'approved',
                    ).length
                  }{' '}
                  approved
                  {selectedOpportunity?.capacity
                    ? ` / ${selectedOpportunity.capacity} places`
                    : ''}
                </h3>
                {review.items
                  .filter((a) => a.scopeKey === scope)
                  .map((application) => (
                    <ApplicationReview
                      key={application._id}
                      application={application}
                      opportunity={selectedOpportunity!}
                      certificates={review.certificates.filter((c) =>
                        application.certificates.includes(c._id),
                      )}
                      busy={busy}
                      action={action}
                    />
                  ))}
              </div>
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}
function ApplicationReview({
  application: a,
  opportunity,
  certificates,
  busy,
  action,
}: {
  application: OrganiserApplication;
  opportunity: Opportunity;
  certificates: Certificate[];
  busy: boolean;
  action: (fn: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState(a.message || '');
  const required = new Set([
    ...opportunity.requiredCertificates,
    ...(a.profile.sellsFood ? opportunity.foodCertificates : []),
  ]);
  const types = [...new Set([...required, ...certificates.map((c) => c.type)])];
  const update = (body: object) =>
    action(
      () =>
        api.marketplace('/manage/applications/' + a._id, {
          method: 'PATCH',
          body: JSON.stringify({ ...body, message }),
        }),
      'Application updated and provider notified.',
    );
  return (
    <article className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h4 className="font-bold">{a.profile.businessName}</h4>
          <p className="text-sm text-muted-foreground">
            Submitted {new Date(a.createdAt).toLocaleString()}
          </p>
        </div>
        <span className="text-sm capitalize">
          {a.status} · Payment: {a.paymentStatus.replace('_', ' ')}
        </span>
      </div>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p>{a.profile.contactName}</p>
          <p>
            <a href={'mailto:' + a.profile.email} className="underline">
              {a.profile.email}
            </a>{' '}
            ·{' '}
            <a href={'tel:' + a.profile.phone} className="underline">
              {a.profile.phone}
            </a>
          </p>
          <p className="mt-2">Categories: {a.profile.categories.join(', ')}</p>
          <p>Sells food: {a.profile.sellsFood ? 'Yes' : 'No'}</p>
          <p>
            Requested:{' '}
            {a.scopeKey === 'regular' ? 'Regular trader' : a.scopeKey}
          </p>
        </div>
        <div>
          <p>Stall size: {a.profile.stall.size}</p>
          {(['power', 'water', 'shelter', 'ownGazebo'] as const).map((key) => (
            <p key={key}>
              {
                {
                  power: 'Needs power',
                  water: 'Needs water',
                  shelter: 'Needs shelter',
                  ownGazebo: 'Has own gazebo',
                }[key]
              }
              : {a.profile.stall[key] ? 'Yes' : 'No'}
            </p>
          ))}
        </div>
      </div>
      {a.note ? (
        <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
          Application note: {a.note}
        </p>
      ) : null}
      <section className="space-y-2">
        <h5 className="text-sm font-semibold">Compliance certificates</h5>
        {types.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No certificates required or attached.
          </p>
        ) : (
          types.map((type) => {
            const certificate = certificates.find((c) => c.type === type);
            const expired =
              certificate?.expiresAt &&
              new Date(certificate.expiresAt).getTime() <= Date.now();
            return (
              <div
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
                key={type}
              >
                <span
                  className={
                    !certificate || expired
                      ? 'font-medium text-destructive'
                      : ''
                  }
                >
                  {certificateLabel(type)}
                  {required.has(type) ? ' (required)' : ''} ·{' '}
                  {!certificate
                    ? 'Missing'
                    : expired
                      ? 'Expired ' +
                        new Date(certificate.expiresAt!).toLocaleDateString()
                      : certificate.expiresAt
                        ? 'Expires ' +
                          new Date(certificate.expiresAt).toLocaleDateString()
                        : 'No expiry date'}
                </span>
                {certificate ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      action(
                        () =>
                          api.downloadStatement(
                            '/marketplace/certificates/' + certificate._id,
                            certificate.name,
                          ),
                        'Certificate downloaded.',
                      )
                    }
                  >
                    Download
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </section>
      <Field label="Message to provider (optional)">
        <textarea
          className={control}
          rows={2}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        {a.status === 'pending' ? (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => update({ status: 'approved' })}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => update({ status: 'declined' })}
            >
              Decline
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => update({ status: a.status })}
          >
            Send message
          </Button>
        )}
        {a.status === 'approved' ? (
          <Field label="Record verified payment status">
            <select
              className={control}
              disabled={busy}
              value={a.paymentStatus}
              onChange={(e) => update({ paymentStatus: e.target.value })}
            >
              {['due', 'paid', 'refunded', 'waived'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
    </article>
  );
}

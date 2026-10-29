import { cloneElement, isValidElement, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { certificateLabel } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import type { Opportunity, MarketOptions } from '@/types/marketplace';
export const control =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const fieldId = useId();
  return (
    <div className="grid gap-1.5 text-sm font-medium">
      <label htmlFor={fieldId}>{label}</label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id: fieldId })
        : children}
    </div>
  );
}
export function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <label
            key={option}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={value.includes(option)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, option]
                    : value.filter((v) => v !== option),
                )
              }
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function OpportunityEditor({
  initial,
  options,
  busy,
  onSave,
  onCancel,
}: {
  initial: Opportunity;
  options: MarketOptions;
  busy: boolean;
  onSave: (value: Opportunity) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [dates, setDates] = useState(initial.dates.join('\n'));
  const [sizes, setSizes] = useState(initial.stallSizes.join('\n'));
  const set = <K extends keyof Opportunity>(key: K, v: Opportunity[K]) =>
    setValue((s) => ({ ...s, [key]: v }));
  const datetime = (v: string) =>
    v
      ? new Date(
          new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : '';
  return (
    <form
      className="space-y-6 rounded-xl border bg-card p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...value,
          dates: dates
            .split(/[\n,]+/)
            .map((v) => v.trim())
            .filter(Boolean),
          stallSizes: sizes
            .split(/[\n,]+/)
            .map((v) => v.trim())
            .filter(Boolean),
          categories: value.categories.filter(Boolean),
        });
      }}
    >
      <h2 className="text-xl font-bold">
        {initial._id ? 'Edit market opportunity' : 'Create market opportunity'}
      </h2>
      <p className="text-sm text-muted-foreground">
        Save as a draft, then publish when ready. Dates, application scope and
        commercial terms are locked once an application is submitted.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Market name">
          <input
            className={control}
            required
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label="Location">
          <input
            className={control}
            required
            value={value.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </Field>
        <Field label="Country code">
          <input
            className={control}
            required
            minLength={2}
            maxLength={2}
            value={value.country}
            onChange={(e) => set('country', e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="Market type">
          <select
            className={control}
            value={value.marketType}
            onChange={(e) => set('marketType', e.target.value)}
          >
            {options.marketTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea
          className={control}
          rows={4}
          required
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </Field>
      <Field label="Types of vendors or service providers sought (categories, separated by commas)">
        <input
          className={control}
          value={value.categories.join(', ')}
          onChange={(e) =>
            set(
              'categories',
              e.target.value.split(',').map((v) => v.trim()),
            )
          }
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Trading dates (YYYY-MM-DD, one per line)">
          <textarea
            className={control}
            rows={4}
            required
            value={dates}
            onChange={(e) => setDates(e.target.value)}
            placeholder="2026-11-18"
          />
        </Field>
        <div className="space-y-4">
          <Field label="Application scope">
            <select
              className={control}
              value={value.scope}
              onChange={(e) =>
                set('scope', e.target.value as Opportunity['scope'])
              }
            >
              <option value="date">Apply for an individual trading date</option>
              <option value="regular">
                Apply as a regular trader for all dates
              </option>
            </select>
          </Field>
          <Field label="Capacity per date (or regular trader places); blank if unspecified">
            <input
              className={control}
              type="number"
              min={1}
              step={1}
              value={value.capacity ?? ''}
              onChange={(e) =>
                set('capacity', e.target.value ? Number(e.target.value) : null)
              }
            />
          </Field>
        </div>
        <Field label="Application deadline (your local time)">
          <input
            className={control}
            type="datetime-local"
            required
            value={datetime(value.applicationDeadline)}
            onChange={(e) =>
              set(
                'applicationDeadline',
                e.target.value ? new Date(e.target.value).toISOString() : '',
              )
            }
          />
        </Field>
        <Field label="Payment deadline (your local time)">
          <input
            className={control}
            type="datetime-local"
            required
            value={datetime(value.paymentDeadline)}
            onChange={(e) =>
              set(
                'paymentDeadline',
                e.target.value ? new Date(e.target.value).toISOString() : '',
              )
            }
          />
        </Field>
      </div>
      <Choices
        label="Availability"
        options={options.availability}
        value={value.availability}
        onChange={(v) => set('availability', v)}
      />
      <fieldset className="space-y-4">
        <legend className="mb-3 font-bold">Stall requirements</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Available stall-size options (one per line)">
            <textarea
              className={control}
              rows={3}
              required
              value={sizes}
              onChange={(e) => setSizes(e.target.value)}
            />
          </Field>
          <Field label="Standard stall size">
            <select
              className={control}
              value={value.stall.size}
              onChange={(e) =>
                set('stall', { ...value.stall, size: e.target.value })
              }
            >
              {[
                ...new Set([
                  ...sizes
                    .split(/[\n,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                  value.stall.size,
                ]),
              ].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-4">
          {(['power', 'water', 'shelter', 'ownGazebo'] as const).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.stall[key]}
                onChange={(e) =>
                  set('stall', { ...value.stall, [key]: e.target.checked })
                }
              />
              {
                {
                  power: 'Power available',
                  water: 'Water available',
                  shelter: 'Shelter provided',
                  ownGazebo: 'Provider must bring a gazebo',
                }[key]
              }
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency (3-letter code)">
          <input
            className={control}
            required
            minLength={3}
            maxLength={3}
            value={value.currency}
            onChange={(e) => set('currency', e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="Base stall fee">
          <input
            className={control}
            type="number"
            required
            min={0}
            step="0.01"
            value={value.stallFee}
            onChange={(e) => set('stallFee', Number(e.target.value))}
          />
        </Field>
      </div>
      {(['feeTiers', 'optionalCharges'] as const).map((key) => (
        <fieldset key={key} className="space-y-3">
          <legend className="mb-2 font-medium">
            {key === 'feeTiers' ? 'Fee tiers' : 'Optional charges'}
          </legend>
          {value[key].map((fee, index) => (
            <div className="flex flex-wrap gap-2" key={index}>
              <Field label="Label">
                <input
                  className={control}
                  required
                  value={fee.label}
                  onChange={(e) =>
                    set(
                      key,
                      value[key].map((v, i) =>
                        i === index ? { ...v, label: e.target.value } : v,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Amount">
                <input
                  className={control}
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={fee.amount}
                  onChange={(e) =>
                    set(
                      key,
                      value[key].map((v, i) =>
                        i === index
                          ? { ...v, amount: Number(e.target.value) }
                          : v,
                      ),
                    )
                  }
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                className="self-end"
                onClick={() =>
                  set(
                    key,
                    value[key].filter((_, i) => i !== index),
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set(key, [...value[key], { label: '', amount: 0 }])}
          >
            Add {key === 'feeTiers' ? 'fee tier' : 'optional charge'}
          </Button>
        </fieldset>
      ))}
      <Field label="Cancellation and refund terms">
        <textarea
          className={control}
          rows={4}
          required
          value={value.cancellationTerms}
          onChange={(e) => set('cancellationTerms', e.target.value)}
        />
      </Field>
      {(['requiredCertificates', 'foodCertificates'] as const).map((key) => (
        <fieldset key={key}>
          <legend className="mb-2 text-sm font-medium">
            {key === 'requiredCertificates'
              ? 'Certificates required from all providers'
              : 'Additional certificates required from food sellers'}
          </legend>
          <div className="flex flex-wrap gap-3">
            {options.certificateTypes.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value[key].includes(type)}
                  onChange={(e) =>
                    set(
                      key,
                      e.target.checked
                        ? [...value[key], type]
                        : value[key].filter((t) => t !== type),
                    )
                  }
                />
                {certificateLabel(type)}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex gap-3">
        <Button disabled={busy}>{busy ? 'Saving…' : 'Save opportunity'}</Button>
        <Button
          variant="outline"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

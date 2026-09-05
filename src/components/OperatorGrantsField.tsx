import { OPERATOR_GRANT_LABELS, type OperatorGrant, type OperatorPopulation } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/**
 * The per-person capability switches shared by every operator admin surface —
 * a role is the floor, these are the extras. Each surface passes the
 * population it manages and sees only the grants that mean something there:
 * stock is stall-scoped and does nothing on a gate operator, the tag desk does
 * nothing on a stall. Filtering is DISPLAY only — grants this surface cannot
 * render are carried through untouched on save.
 */
export function OperatorGrantsField({
  population,
  value,
  onChange,
  disabled,
  idPrefix = 'grant',
}: {
  population: OperatorPopulation;
  value: OperatorGrant[];
  onChange: (next: OperatorGrant[]) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const grants = (Object.keys(OPERATOR_GRANT_LABELS) as OperatorGrant[]).filter((g) =>
    OPERATOR_GRANT_LABELS[g].appliesTo.includes(population),
  );

  const toggle = (grant: OperatorGrant, on: boolean) =>
    onChange(on ? [...new Set([...value, grant])] : value.filter((g) => g !== grant));

  return (
    <div className="space-y-2">
      {grants.map((grant) => {
        const meta = OPERATOR_GRANT_LABELS[grant];
        const id = `${idPrefix}-${grant}`;
        return (
          <div key={grant} className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor={id}>{meta.label}</Label>
              <p className="text-xs text-muted-foreground">{meta.hint}</p>
            </div>
            <Switch
              id={id}
              checked={value.includes(grant)}
              disabled={disabled}
              onCheckedChange={(on) => toggle(grant, on)}
            />
          </div>
        );
      })}
    </div>
  );
}

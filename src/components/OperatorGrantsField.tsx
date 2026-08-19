import { OPERATOR_GRANT_LABELS, type OperatorGrant } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const ALL_GRANTS = Object.keys(OPERATOR_GRANT_LABELS) as OperatorGrant[];

/**
 * The per-person capability switches shared by every operator admin surface —
 * a role is the floor, these are the extras. Gate operators and cashiers offer
 * the same list because a grant means the same thing to both; the API decides
 * what each one unlocks.
 */
export function OperatorGrantsField({
  value,
  onChange,
  disabled,
  idPrefix = 'grant',
}: {
  value: OperatorGrant[];
  onChange: (next: OperatorGrant[]) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const toggle = (grant: OperatorGrant, on: boolean) =>
    onChange(on ? [...new Set([...value, grant])] : value.filter((g) => g !== grant));

  return (
    <div className="space-y-2">
      {ALL_GRANTS.map((grant) => {
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

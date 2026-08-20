import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * The headline tile the cashless surfaces answer their top question with — a
 * tinted label, one big number, and the sentence that says what the number
 * counts. Shared so Money's totals and the stock page's totals stay the same
 * object rather than drifting into two lookalikes.
 */
export function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: 'ink' | 'blue' | 'orange' | 'green';
}) {
  const toneClass = {
    ink: 'text-foreground',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    green: 'text-green-600',
  }[tone];
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${toneClass}`}>
          {icon}
          {label}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </CardContent>
    </Card>
  );
}

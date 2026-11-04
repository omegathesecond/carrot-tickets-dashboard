import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OrganizersListResponse } from '@/types';
import { ORGANIZER_TABS, type OrganizerTab } from './organizerModel';

interface OrganizerTypeTabsProps {
  value: OrganizerTab;
  /** Absent until the first list response lands — the labels show no count until then. */
  counts?: OrganizersListResponse['typeCounts'];
  onChange: (tab: OrganizerTab) => void;
  /** Everything the open tab shows; it is the tab's panel. */
  children: ReactNode;
}

export function OrganizerTypeTabs({ value, counts, onChange, children }: OrganizerTypeTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as OrganizerTab)} className="space-y-6">
      <TabsList className="h-auto flex-wrap justify-start">
        {ORGANIZER_TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {counts ? `${t.label} (${counts[t.value].toLocaleString()})` : t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={value} className="mt-0 space-y-6">
        {children}
      </TabsContent>
    </Tabs>
  );
}

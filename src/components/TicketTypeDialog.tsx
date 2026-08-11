import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TicketType } from '@/types';
import { apiClient } from '@/lib/api';

export interface TicketTypeSubmitData {
  name: string;
  description?: string;
  price: number;
  quantity: number;
  isAllocation?: boolean;
  resellerId?: string;
  allocationUnitCost?: number;
  restrictToMethod?: string;
  waiveServiceFee?: boolean;
}

interface TicketTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TicketTypeSubmitData) => void;
  ticketType?: TicketType | null;
  isLoading?: boolean;
  /** Super-admin only: reveals the reseller-allocation section (Carrot sets up
   *  pre-bought blocks like a DeltaPay-exclusive tier). */
  isAdmin?: boolean;
}

const ALLOC_METHODS = [
  { value: 'deltapay', label: 'DeltaPay' },
  { value: 'mtn_momo', label: 'MTN MoMo' },
  { value: 'peach_card', label: 'Card' },
  { value: 'keshless_wallet', label: 'Keshless Wallet' },
];

export function TicketTypeDialog({
  open,
  onOpenChange,
  onSubmit,
  ticketType,
  isLoading = false,
  isAdmin = false,
}: TicketTypeDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    quantity: 1,
  });
  // Reseller-allocation section (super-admin, new tiers only).
  const [isAllocation, setIsAllocation] = useState(false);
  const [alloc, setAlloc] = useState({
    resellerId: '',
    allocationUnitCost: 0,
    restrictToMethod: 'deltapay',
    waiveServiceFee: true,
  });

  const isEdit = !!ticketType;
  const hasSold = ticketType && ticketType.sold > 0;
  const showAllocation = isAdmin && !isEdit;

  const { data: resellers = [] } = useQuery({
    queryKey: ['admin', 'resellers'],
    queryFn: () => apiClient.resellerAdmin.listResellers(),
    enabled: open && showAllocation,
  });

  useEffect(() => {
    if (ticketType) {
      setFormData({
        name: ticketType.name,
        description: ticketType.description || '',
        price: ticketType.price,
        quantity: ticketType.quantity,
      });
    } else {
      setFormData({ name: '', description: '', price: 0, quantity: 1 });
    }
    setIsAllocation(false);
    setAlloc({ resellerId: '', allocationUnitCost: 0, restrictToMethod: 'deltapay', waiveServiceFee: true });
  }, [ticketType, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      description: formData.description || undefined,
      price: formData.price,
      quantity: formData.quantity,
      ...(showAllocation && isAllocation
        ? {
            isAllocation: true,
            resellerId: alloc.resellerId,
            allocationUnitCost: alloc.allocationUnitCost,
            restrictToMethod: alloc.restrictToMethod,
            waiveServiceFee: alloc.waiveServiceFee,
          }
        : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Ticket Type' : 'Add Ticket Type'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ticket Type Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., General, VIP, Early Bird"
              required
              disabled={hasSold}
            />
            {hasSold && (
              <p className="text-xs text-amber-600">
                Cannot change name after tickets have been sold
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What's included with this ticket?"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (E)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                min="0"
                step="0.01"
                required
                disabled={hasSold}
              />
              {hasSold && (
                <p className="text-xs text-amber-600">
                  Cannot change price after tickets sold
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                min={hasSold ? ticketType.sold : 1}
                required
              />
              {hasSold && (
                <p className="text-xs text-slate-600">
                  Min: {ticketType.sold} (already sold)
                </p>
              )}
            </div>
          </div>

          {showAllocation && (
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={isAllocation}
                  onChange={(e) => setIsAllocation(e.target.checked)}
                />
                Reseller allocation block (pre-bought, resold on a reseller's behalf)
              </label>
              {isAllocation && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="alloc-reseller">Reseller</Label>
                    <select
                      id="alloc-reseller"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={alloc.resellerId}
                      onChange={(e) => setAlloc({ ...alloc, resellerId: e.target.value })}
                      required
                    >
                      <option value="" disabled>Select a reseller…</option>
                      {resellers.map((r) => (
                        <option key={r._id} value={r._id}>{r.businessName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="alloc-cost">Unit cost paid (E)</Label>
                      <Input
                        id="alloc-cost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={alloc.allocationUnitCost}
                        onChange={(e) => setAlloc({ ...alloc, allocationUnitCost: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="alloc-method">Pay method (locked)</Label>
                      <select
                        id="alloc-method"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={alloc.restrictToMethod}
                        onChange={(e) => setAlloc({ ...alloc, restrictToMethod: e.target.value })}
                      >
                        {ALLOC_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={alloc.waiveServiceFee}
                      onChange={(e) => setAlloc({ ...alloc, waiveServiceFee: e.target.checked })}
                    />
                    Waive the buyer service fee (buyer pays face)
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Sales route to the reseller's settlement and stay off the organizer's revenue.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEdit ? 'Update Ticket Type' : 'Add Ticket Type'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

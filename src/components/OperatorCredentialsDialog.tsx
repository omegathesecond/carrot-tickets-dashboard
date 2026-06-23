import { toast } from 'sonner';
import { Copy, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface OperatorCredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  loginCode?: string;
  pin: string;
  businessName?: string;
  hubName?: string;
}

export function OperatorCredentialsDialog({
  open, onClose, title, loginCode, pin, businessName, hubName,
}: OperatorCredentialsDialogProps) {
  const copyText = `${loginCode ? `User ID: ${loginCode}\n` : ''}PIN: ${pin}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      toast.success('Credentials copied');
    } catch {
      toast.error('Could not copy — please write them down');
    }
  };

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=420,height=520');
    if (!w) {
      toast.error('Could not open print window (popup blocked)');
      return;
    }

    const doc = w.document;
    doc.title = 'Operator Credentials';

    const style = doc.createElement('style');
    style.textContent = [
      'body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a}',
      'h1{font-size:18px;margin:0 0 4px}',
      '.sub{color:#64748b;font-size:13px;margin-bottom:24px}',
      '.row{margin:16px 0}',
      '.label{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}',
      '.value{font-size:32px;font-weight:700;font-family:ui-monospace,monospace;letter-spacing:.1em}',
      '.warn{margin-top:28px;font-size:12px;color:#b91c1c}',
    ].join('');
    doc.head.appendChild(style);

    const setText = (el: HTMLElement, text: string) => { el.textContent = text; };

    const h1 = doc.createElement('h1');
    setText(h1, businessName ?? 'Carrot Tickets');
    doc.body.appendChild(h1);

    const sub = doc.createElement('div');
    sub.className = 'sub';
    setText(sub, hubName ? `Hub: ${hubName}` : 'Operator credentials');
    doc.body.appendChild(sub);

    if (loginCode) {
      const row = doc.createElement('div');
      row.className = 'row';
      const label = doc.createElement('div');
      label.className = 'label';
      setText(label, 'User ID');
      const value = doc.createElement('div');
      value.className = 'value';
      setText(value, loginCode);
      row.appendChild(label);
      row.appendChild(value);
      doc.body.appendChild(row);
    }

    const pinRow = doc.createElement('div');
    pinRow.className = 'row';
    const pinLabel = doc.createElement('div');
    pinLabel.className = 'label';
    setText(pinLabel, 'PIN');
    const pinValue = doc.createElement('div');
    pinValue.className = 'value';
    setText(pinValue, pin);
    pinRow.appendChild(pinLabel);
    pinRow.appendChild(pinValue);
    doc.body.appendChild(pinRow);

    const warn = doc.createElement('div');
    warn.className = 'warn';
    setText(warn, 'Keep confidential — do not share. PIN can only be reset, not recovered.');
    doc.body.appendChild(warn);

    w.focus();
    w.print();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {loginCode && (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">User ID</p>
              <p className="text-3xl font-bold font-mono tracking-widest text-slate-900">{loginCode}</p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">PIN</p>
            <p className="text-3xl font-bold font-mono tracking-widest text-slate-900">{pin}</p>
          </div>
          <p className="text-xs text-red-600">
            Shown once. Keep it confidential — the PIN can be reset but never recovered.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
          <Button
            onClick={onClose}
            className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:opacity-90"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

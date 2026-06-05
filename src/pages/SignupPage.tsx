import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { AuthHeader } from '@/components/AuthHeader';

const BUSINESS_TYPES = [
  { value: 'event_organizer', label: 'Event Organizer' },
  { value: 'venue', label: 'Venue' },
  { value: 'promoter', label: 'Promoter' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'sports', label: 'Sports' },
  { value: 'other', label: 'Other' },
];

export function SignupPage() {
  const [form, setForm] = useState({
    businessName: '',
    email: '',
    phoneNumber: '',
    password: '',
    businessType: 'event_organizer',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email && !form.phoneNumber) {
      toast.error('Enter an email address or phone number');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        businessName: form.businessName,
        password: form.password,
        businessType: form.businessType,
        // Only send the contact fields that were filled in.
        ...(form.email ? { email: form.email } : {}),
        ...(form.phoneNumber ? { phoneNumber: form.phoneNumber } : {}),
      });
      toast.success('Account created! You can start building events now.');
      await new Promise((resolve) => setTimeout(resolve, 250));
      navigate('/', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 py-10 pt-20">
      <AuthHeader />
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="h-16 w-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
              <Ticket className="h-10 w-10 text-white" />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">Create your organizer account</CardTitle>
            <CardDescription>Start selling tickets to your events on Keshless</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Organizer / Business name</Label>
              <Input
                id="businessName"
                placeholder="e.g. Mbabane Live Events"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Type</Label>
              <select
                id="businessType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.businessType}
                onChange={(e) => setForm({ ...form, businessType: e.target.value })}
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone number</Label>
              <Input
                id="phoneNumber"
                placeholder="+268 7XXX XXXX"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Provide an email or a phone number (or both).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-orange-600 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

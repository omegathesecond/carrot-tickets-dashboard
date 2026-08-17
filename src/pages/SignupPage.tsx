import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneField } from '@/components/PhoneField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { AuthHeader } from '@/components/AuthHeader';
import { BRAND_NAME } from '@/lib/brand';

const BUSINESS_TYPES = [
  { value: 'event_organizer', label: 'Event Organizer' },
  { value: 'venue', label: 'Venue' },
  { value: 'promoter', label: 'Promoter' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'sports', label: 'Sports' },
  { value: 'other', label: 'Other' },
];

export function SignupPage() {
  // Two-step signup: collect the organizer's details (step 'details'), send a
  // 6-digit code to the email/phone they entered, then create the account only
  // once they enter that code (step 'verify'). This proves they control the
  // contact channel before an account exists — same OTP flow as password reset.
  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [form, setForm] = useState({
    businessName: '',
    email: '',
    phoneNumber: '',
    password: '',
    businessType: 'event_organizer',
  });
  // Where the server sent the code (echoed back from step 1) — used to tell the
  // organizer exactly where to look.
  const [channel, setChannel] = useState<'sms' | 'email'>('email');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email && !form.phoneNumber) {
      toast.error('Enter an email address or phone number');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.auth.requestRegistrationOtp({
        // Only send the contact fields that were filled in.
        ...(form.email ? { email: form.email } : {}),
        ...(form.phoneNumber ? { phoneNumber: form.phoneNumber } : {}),
      });
      setChannel(res.channel);
      setSentTo(res.identifier);
      setStep('verify');
      toast.success(res.channel === 'sms' ? 'We texted you a verification code' : 'We emailed you a verification code');
    } catch (error: any) {
      toast.error(error.message || 'Could not send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    try {
      await register({
        businessName: form.businessName,
        password: form.password,
        businessType: form.businessType,
        code,
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
            <img src="/carrot_tickets_icon.png" alt={BRAND_NAME} className="h-16 w-16" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">Create your organizer account</CardTitle>
            <CardDescription>
              {step === 'details'
                ? `Start selling tickets to your events on ${BRAND_NAME}`
                : channel === 'sms'
                  ? `Enter the 6-digit code we texted to ${sentTo}.`
                  : `Enter the 6-digit code we emailed to ${sentTo}.`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {step === 'details' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
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
                {/* PhoneField emits full E.164 (+26876123456) when digits are typed,
                    and '' when the local part is empty. The '' is load-bearing: the
                    "email or phone" validation below checks `!form.phoneNumber`, and
                    the payload only sends the field when truthy — so an email-only
                    signup must not leak a bare '+268'. */}
                <PhoneField
                  id="phoneNumber"
                  value={form.phoneNumber}
                  onChange={(phoneNumber) => setForm({ ...form, phoneNumber })}
                />
                <p className="text-xs text-muted-foreground">
                  Provide an email or a phone number (or both). We’ll send a verification code to confirm it’s yours.
                </p>
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
                {isLoading ? 'Sending code...' : 'Continue'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-orange-600 font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyAndCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Verify & create account'}
              </Button>
              <button
                type="button"
                onClick={() => { setStep('details'); setCode(''); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Edit your details or use a different email / phone
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
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
import { getOperatorContext, operatorHomePath } from '@/lib/operatorContext';

export function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  // Same email/phone identifier model as the login screen: Email is the default
  // and Phone swaps in the country picker so an E.164 number is sent. Switching
  // clears the field so an email can't leak through as a phone (or vice-versa).
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email'>('email');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reset, setReset] = useState(false);

  const { resetPassword, user } = useAuth();
  const navigate = useNavigate();

  const switchMode = (next: 'email' | 'phone') => {
    setMode(next);
    setIdentifier('');
  };

  // resetPassword() signs the organizer in via AuthContext; wait for the context
  // to re-render with the authenticated user before deciding where to land
  // (mirrors LoginPage).
  useEffect(() => {
    if (reset && user) {
      navigate(operatorHomePath(getOperatorContext(user)), { replace: true });
    }
  }, [reset, user, navigate]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      toast.error(mode === 'email' ? 'Enter your email' : 'Enter your phone number');
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiClient.auth.requestPasswordReset(identifier);
      setChannel(res.channel);
      setStep('verify');
      toast.success(res.channel === 'sms' ? 'We texted you a reset code' : 'We emailed you a reset code');
    } catch (error: any) {
      toast.error(error.message || 'Could not send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword({ identifier, code, newPassword });
      toast.success('Password updated. You are signed in.');
      await new Promise((resolve) => setTimeout(resolve, 250));
      setReset(true);
    } catch (error: any) {
      toast.error(error.message || 'Could not reset password');
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
            <CardTitle className="text-2xl">Reset your password</CardTitle>
            <CardDescription>
              {step === 'request'
                ? 'We’ll send a 6-digit code to your account’s email or phone.'
                : channel === 'sms'
                  ? `Enter the code we texted to ${identifier} and choose a new password.`
                  : `Enter the code we emailed to ${identifier} and choose a new password.`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {step === 'request' ? (
            <form onSubmit={handleRequest} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="identifier">{mode === 'email' ? 'Email' : 'Phone'}</Label>
                  <div className="flex rounded-md border border-input p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => switchMode('email')}
                      className={`rounded px-2 py-0.5 font-medium transition-colors ${mode === 'email' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('phone')}
                      className={`rounded px-2 py-0.5 font-medium transition-colors ${mode === 'phone' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Phone
                    </button>
                  </div>
                </div>
                {mode === 'email' ? (
                  <Input
                    id="identifier"
                    type="email"
                    placeholder="you@example.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                ) : (
                  <PhoneField
                    id="identifier"
                    value={identifier}
                    onChange={(next) => setIdentifier(next)}
                    required
                  />
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
                disabled={isLoading}
              >
                {isLoading ? 'Sending code...' : 'Send reset code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
                disabled={isLoading}
              >
                {isLoading ? 'Resetting...' : 'Reset password'}
              </Button>
              <button
                type="button"
                onClick={() => { setStep('request'); setCode(''); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Use a different email or phone
              </button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Remembered it?{' '}
            <Link to="/login" className="text-orange-600 font-medium hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

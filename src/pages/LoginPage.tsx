import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneField } from '@/components/PhoneField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { AuthHeader } from '@/components/AuthHeader';
import { BRAND_NAME } from '@/lib/brand';
import { getOperatorContext, operatorHomePath } from '@/lib/operatorContext';

export function LoginPage() {
  const [credentials, setCredentials] = useState({ identifier: '', password: '' });
  // The API takes one `identifier` (email OR phone). Email stays the default
  // organizer login; Phone mode swaps in the country picker so an E.164 number
  // is sent instead of free-typed digits. Switching clears the field so an
  // email can't leak through as a phone identifier (or vice-versa).
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [isLoading, setIsLoading] = useState(false);

  const switchMode = (next: 'email' | 'phone') => {
    setMode(next);
    setCredentials((c) => ({ ...c, identifier: '' }));
  };
  const [loggedIn, setLoggedIn] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // `login()` resolves once AuthContext has scheduled its user-state update,
  // but the `user` this handler closed over is still the pre-login value —
  // wait for the context to actually re-render with the freshly-authenticated
  // user before deciding where to land, instead of navigating too early.
  useEffect(() => {
    if (loggedIn && user) {
      navigate(operatorHomePath(getOperatorContext(user)), { replace: true });
    }
  }, [loggedIn, user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(credentials);
      toast.success('Login successful');
      await new Promise(resolve => setTimeout(resolve, 250));
      setLoggedIn(true);
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100">
      <AuthHeader />
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center">
            <img src="/carrot_tickets_icon.png" alt={BRAND_NAME} className="h-16 w-16" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">{BRAND_NAME}</CardTitle>
            <CardDescription>Event Ticketing Dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
                  value={credentials.identifier}
                  onChange={(e) =>
                    setCredentials({ ...credentials, identifier: e.target.value })
                  }
                  required
                />
              ) : (
                <PhoneField
                  id="identifier"
                  value={credentials.identifier}
                  onChange={(identifier) => setCredentials((c) => ({ ...c, identifier }))}
                  required
                />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-orange-600 font-medium hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New here?{' '}
              <Link to="/signup" className="text-orange-600 font-medium hover:underline">
                Create an organizer account
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

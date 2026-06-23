import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { resellerApi, type ResellerOperator } from '@/lib/resellerApi';

interface ResellerAuthContextType {
  operator: ResellerOperator | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (loginCode: string, pin: string) => Promise<void>;
  logout: () => void;
}

const ResellerAuthContext = createContext<ResellerAuthContextType | undefined>(undefined);

export function ResellerAuthProvider({ children }: { children: ReactNode }) {
  const [operator, setOperator] = useState<ResellerOperator | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = resellerApi.getToken();
    if (token) {
      setIsAuthenticated(true);
      setOperator(resellerApi.getOperator());
    }
    setIsLoading(false);
  }, []);

  const login = async (loginCode: string, pin: string) => {
    const result = await resellerApi.login({ loginCode, pin });
    setOperator(result.operator);
    setIsAuthenticated(true);
  };

  const logout = () => {
    resellerApi.logout();
    setOperator(null);
    setIsAuthenticated(false);
    navigate('/reseller/login');
  };

  return (
    <ResellerAuthContext.Provider value={{ operator, isAuthenticated, isLoading, login, logout }}>
      {children}
    </ResellerAuthContext.Provider>
  );
}

export function useResellerAuth() {
  const context = useContext(ResellerAuthContext);
  if (context === undefined) {
    throw new Error('useResellerAuth must be used within a ResellerAuthProvider');
  }
  return context;
}

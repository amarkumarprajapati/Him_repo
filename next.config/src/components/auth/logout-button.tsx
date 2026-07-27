'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { clearAuthCookie } from '@/utils/auth-cookie';
import { showToast } from '@/utils/toast';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    clearAuthCookie();
    showToast.info('Signed out.');
    router.push('/login');
    router.refresh();
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleLogout}>
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}

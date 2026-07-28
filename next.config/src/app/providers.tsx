'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import { slideBottom } from '@/utils/toast';
import { UiProvider } from '@/components/layout/ui-context';
import { store } from '@/store';
import { useAppDispatch } from '@/store/hooks';
import { restoreAuthSession } from '@/store/slices/authSlice';

interface ProvidersProps {
  children: ReactNode;
}

function AuthBootstrap() {
  const dispatch = useAppDispatch();
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    dispatch(restoreAuthSession());
  }, [dispatch]);

  return null;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ReduxProvider store={store}>
      <AuthBootstrap />
      <UiProvider>
        {children}
        <ToastContainer
          position="bottom-center"
          transition={slideBottom}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          pauseOnHover
          theme="dark"
        />
      </UiProvider>
    </ReduxProvider>
  );
}

'use client';

import type { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import { slideBottom } from '@/utils/toast';
import { UiProvider } from '@/components/layout/ui-context';
import { store } from '@/store';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ReduxProvider store={store}>
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

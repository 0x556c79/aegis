'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { privyConfig } from '../lib/privy';

// Lazy-load Privy so Next build/prerender does not evaluate Privy code on the server.
const PrivyProvider = dynamic(
  () => import('@privy-io/react-auth').then((m) => m.PrivyProvider),
  { ssr: false },
);

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  return (
    <QueryClientProvider client={queryClient}>
      {appId ? (
        <PrivyProvider 
          appId={appId}
          config={privyConfig}
        >
          {children}
        </PrivyProvider>
      ) : (
        children
      )}
    </QueryClientProvider>
  );
}

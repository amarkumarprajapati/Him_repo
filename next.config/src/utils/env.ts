import { z } from 'zod';

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().min(1).default('/api'),
  NEXT_PUBLIC_APP_NAME: z.string().default('HIMSHRAVAN'),
});

const _serverEnv = serverSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
});

if (!_serverEnv.success) {
  console.error(
    'Invalid server environment variables:',
    z.treeifyError(_serverEnv.error),
  );
  throw new Error('Invalid server environment variables.');
}

const _clientEnv = clientSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});

if (!_clientEnv.success) {
  console.error(
    'Invalid client environment variables:',
    z.treeifyError(_clientEnv.error),
  );
  throw new Error('Invalid client environment variables.');
}

export const serverEnv = _serverEnv.data;
export const clientEnv = _clientEnv.data;

import type { Metadata } from 'next';

import { SignUpForm } from '@/components/auth-forms';
import { AuthShell } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Create your Cravora account" subtitle="Track orders, save favorites and reorder faster.">
      <SignUpForm next={next} />
    </AuthShell>
  );
}

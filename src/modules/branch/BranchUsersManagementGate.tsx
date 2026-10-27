'use client';

import React, { useEffect, useState } from 'react';
import UsersManagement from '@/components/users/UsersManagement';
import { fetchCognitoUsersAction, type CognitoUser } from '@/app/actions/cognitoActions';
import { useApp } from '@/context/AppContext';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';

export default function BranchUsersManagementGate({ slug }: { slug?: string }) {
  const { branches, isInitialLoading } = useApp();
  const branch = branches.find(b => b.slug === slug);
  const [users, setUsers] = useState<CognitoUser[] | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetchCognitoUsersAction(slug).then(res => {
      if (cancelled) return;
      if (res.success && res.data) setUsers(res.data);
      else {
        setUsers([]);
        setError(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug || !branch) {
    if (isInitialLoading) return <ASICTableSkeleton cols={5} />;
    return <p className="text-sm text-slate-500">Branch not found.</p>;
  }

  if (!users) return <ASICTableSkeleton cols={5} />;

  return (
    <UsersManagement
      initialUsers={users}
      error={error}
      fixedBranchId={branch.id}
      branchSlug={slug}
      isBranchManager
    />
  );
}

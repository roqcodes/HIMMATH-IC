'use client';

import React, { useEffect, useState } from 'react';
import UsersManagement from '@/components/users/UsersManagement';
import { fetchCognitoUsersAction, type CognitoUser } from '@/app/actions/cognitoActions';
import { useApp } from '@/context/AppContext';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';

export default function UsersManagementGate() {
  const { user } = useApp();
  const [users, setUsers] = useState<CognitoUser[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const isSuperAdmin = user?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    fetchCognitoUsersAction().then(res => {
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
  }, []);

  if (!users) return <ASICTableSkeleton cols={5} />;
  return <UsersManagement initialUsers={users} error={error} isSuperAdmin={isSuperAdmin} />;
}

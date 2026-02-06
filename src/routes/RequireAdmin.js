import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { isAdminEmailAllowed } from '../adminAccess';

export default function RequireAdmin({ children }) {
  const [state, setState] = useState({ loading: true, user: null });
  const location = useLocation();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const user = data?.session?.user || null;
      if (!user) {
        setState({ loading: false, user: null });
        return;
      }
      const allowed = isAdminEmailAllowed(user.email);
      if (!allowed) {
        supabase.auth.signOut();
        setState({ loading: false, user: null });
        return;
      }
      setState({ loading: false, user });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      if (!user) {
        setState({ loading: false, user: null });
        return;
      }
      const allowed = isAdminEmailAllowed(user.email);
      if (!allowed) {
        supabase.auth.signOut();
        setState({ loading: false, user: null });
        return;
      }
      setState({ loading: false, user });
    });

    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  if (state.loading) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        A carregar…
      </div>
    );
  }

  if (!state.user) {
    return (
      <Navigate
        to={`/admin_rocha?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return children;
}

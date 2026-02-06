import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/admin.css';
import { supabase } from '../supabase';
import { isAdminEmailAllowed } from '../adminAccess';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const query = useQuery();

  const next = query.get('next') || '/admin_rocha/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    document.body.classList.remove('kiosk-body');
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setOk('');
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (authError) throw authError;

      const userEmail = data?.user?.email || '';
      if (!isAdminEmailAllowed(userEmail)) {
        await supabase.auth.signOut();
        setError('Este utilizador não tem permissões de admin.');
        return;
      }

      setOk('Login efetuado. A redirecionar...');
      navigate(next, { replace: true });
    } catch (err) {
      const code = err?.code || '';
      if (code === 'invalid_credentials') {
        setError('Credenciais inválidas.');
      } else {
        setError('Falha no login. Verifique a internet e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Admin</h1>
        <p className="subtitle">Acesso restrito</p>

        <div className="login-hint">
          Use uma conta de administrador do Supabase Auth (Email/Password).
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@exemplo.com"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="form-actions">
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
          </div>
        </form>

        {error ? <div className="error-message">{error}</div> : null}
        {ok ? <div className="success-message">{ok}</div> : null}

        <div className="back-link">
          <Link to="/">← Voltar ao quiosque</Link>
        </div>
      </div>
    </div>
  );
}

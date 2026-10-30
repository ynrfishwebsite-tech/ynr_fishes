import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ynrLogo from '../assets/ynr_logo_hd.jpg';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, getDashboardPath, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated && user) {
      const dest = location.state?.from?.pathname || getDashboardPath(user.role);
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location, getDashboardPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setErrorMsg('Please enter both your identifier and password');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await login(identifier, password);
      if (res.success) {
        const dest = getDashboardPath(res.user.role);
        navigate(dest, { replace: true });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid username/email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-login-viewport">
      <div className="glass-login-card">
        {/* Brand Header */}
        <div className="login-brand-header">
          <img
            src={ynrLogo}
            alt="YNR Fishes"
            className="login-brand-logo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = ynrLogo;
            }}
          />
          <h1 className="login-brand-title">YNR Fishes Staff Portal</h1>
          <p className="login-brand-subtitle">
            Sign in with your role credentials to access your workspace
          </p>
        </div>

        {/* Clean Glassmorphic Login Form */}
        <form className="glass-login-form" onSubmit={handleSubmit}>
          {errorMsg && <div className="error-notice">{errorMsg}</div>}

          <div className="form-field">
            <label className="field-label" htmlFor="staff-identifier">
              Email or Username
            </label>
            <div className="input-box">
              <input
                id="staff-identifier"
                type="text"
                className="glass-input"
                placeholder="Enter email or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor="staff-password">
              Password
            </label>
            <div className="input-box">
              <input
                id="staff-password"
                type={showPassword ? 'text' : 'password'}
                className="glass-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="show-hide-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="glass-submit-btn"
            disabled={isSubmitting}
            id="login-submit-btn"
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>

        <div className="portal-notice">
          YNR Fishes Multi-Branch ERP • Vijayawada • Vizag • Kadapa
        </div>
      </div>
    </div>
  );
}

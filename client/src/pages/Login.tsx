import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@teknoloji.com');
  const [pass, setPass] = useState('demo1234');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div className="logo-icon">E</div>
          <div className="logo-text">Entegrasyon<span>Platformu</span></div>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Giriş Yap</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Demo hesabı ile devam edin</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">E-posta</label>
            <input className="form-control" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Şifre</label>
            <input className="form-control" type="password" value={pass} onChange={e => setPass(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>Giriş Yap</button>
        </form>
      </div>
    </div>
  );
}

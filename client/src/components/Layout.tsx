import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  title: string | React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function Layout({ title, actions, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main">
        <header className="header">
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>
            <svg width={20} height={20} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="header-title">{title}</div>
          <div className="header-actions">
            {actions}
            <button className="header-btn" title="Bildirimler">
              <svg width={17} height={17} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <div className="dot" />
            </button>
            <button className="header-user">
              <div className="user-avatar">TA</div>
              <span className="user-name">Teknoloji A.Ş.</span>
            </button>
          </div>
        </header>

        <div className="page">
          {children}
        </div>
      </main>
    </div>
  );
}

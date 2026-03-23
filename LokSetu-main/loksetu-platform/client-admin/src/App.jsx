import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from './i18n/index.js';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate
} from 'react-router-dom';
import {
  Home, UserPlus, MapPin, BarChart3, Shield,
  Menu, X, Activity, Bell, Settings,
  ChevronRight, AlertTriangle, CheckCircle, Info,
  User, LogOut, Sliders, HelpCircle, Mail,
  FileText, BookOpen, Vote, UserCheck, ShieldAlert, ScrollText, Lock,
  Globe, ZoomIn, ZoomOut, Eye, Sun, Moon, RotateCcw, AlertCircle, Loader2
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import RegistrationRequests from './pages/RegistrationRequests';
import UpdateConstituency from './pages/UpdateConstituency';
import Result from './pages/Result';
import ErrorBoundary from './components/ErrorBoundary';
import FraudMonitor from './pages/FraudMonitor';
import Analytics from './pages/Analytics';
import SystemLogs from './pages/SystemLogs';
import ElectionSetup from './pages/ElectionSetup';
import ElectionHistory from './pages/ElectionHistory';
import Chatbot from './components/Chatbot';

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

const AccessibilityContext = createContext();
export const useAccessibility = () => useContext(AccessibilityContext);

const ThemeProvider = ({ children }) => {
  const [dark, setDark] = useState(() => localStorage.getItem('loksetu-theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('loksetu-theme', dark ? 'dark' : 'light');
  }, [dark]);
  const toggle = () => setDark(d => !d);
  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

const AccessibilityProvider = ({ children }) => {
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('loksetu-fontsize') || '16'));
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('loksetu-hc') === 'true');

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem('loksetu-fontsize', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    localStorage.setItem('loksetu-hc', highContrast.toString());
  }, [highContrast]);

  const increase = () => setFontSize(s => Math.min(s + 2, 24));
  const decrease = () => setFontSize(s => Math.max(s - 2, 12));
  const reset = () => setFontSize(16);

  return (
    <AccessibilityContext.Provider value={{ fontSize, increase, decrease, reset, highContrast, toggleContrast: () => setHighContrast(p => !p) }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

// Language Selector Dropdown
const LanguageSelector = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  const changeLang = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('loksetu-lang', code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-dash-text-secondary hover:text-dash-primary hover:bg-orange-50 transition-colors border border-dash-border"
        aria-label="Select language"
        title="Change language"
      >
        <Globe size={14} />
        <span className="hidden sm:inline">{current.nativeLabel}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl shadow-2xl border border-dash-border z-50 animate-slide-down overflow-hidden max-h-80 overflow-y-auto surface">
          <div className="px-3 py-2 border-b border-dash-border surface-alt">
            <p className="text-xs font-bold text-dash-text-secondary">Select Language / भाषा चुनें</p>
          </div>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => changeLang(lang.code)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-orange-50 transition-colors ${
                i18n.language === lang.code ? 'bg-dash-primary/5 text-dash-primary font-bold' : 'text-dash-text'
              }`}
            >
              <span>{lang.nativeLabel}</span>
              <span className="text-xs text-dash-text-secondary">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Accessibility Toolbar
const AccessibilityToolbar = () => {
  const { fontSize, increase, decrease, reset, highContrast, toggleContrast } = useAccessibility();
  const { dark, toggle: toggleDark } = useTheme();
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <button onClick={toggleDark} className={`p-1.5 rounded transition ${dark ? 'bg-dash-accent text-white' : 'text-dash-text-secondary hover:text-dash-primary hover:bg-orange-50'}`} aria-label={dark ? t('theme.lightMode') : t('theme.darkMode')} title={dark ? t('theme.lightMode') : t('theme.darkMode')}>
        {dark ? <Sun size={14} /> : <Moon size={14} />}
      </button>
      <span className="theme-indicator" aria-hidden="true">{dark ? 'Dark' : 'Light'}</span>
      <button onClick={decrease} className="p-1.5 rounded text-dash-text-secondary hover:text-dash-primary hover:bg-orange-50 transition" aria-label="Decrease font size" title="A-">
        <ZoomOut size={14} />
      </button>
      <button onClick={reset} className="px-1.5 py-0.5 rounded text-[10px] font-bold text-dash-text-secondary hover:text-dash-primary hover:bg-orange-50 transition" aria-label="Reset font size" title="Reset font">
        {fontSize}
      </button>
      <button onClick={increase} className="p-1.5 rounded text-dash-text-secondary hover:text-dash-primary hover:bg-orange-50 transition" aria-label="Increase font size" title="A+">
        <ZoomIn size={14} />
      </button>
      <button onClick={toggleContrast} className={`p-1.5 rounded transition ${highContrast ? 'bg-dash-primary text-white' : 'text-dash-text-secondary hover:text-dash-primary hover:bg-orange-50'}`} aria-label="Toggle high contrast" title="High Contrast">
        <Eye size={14} />
      </button>
    </div>
  );
};

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const useNavItems = () => {
  const { t } = useTranslation();
  return [
    { path: '/', label: t('nav.dashboard'), icon: Home },
    { path: '/registration-requests', label: t('nav.registrationRequests', 'Registration Requests'), icon: UserCheck },
    { path: '/election-setup', label: t('nav.electionSetup', 'Election Setup'), icon: UserPlus },
    { path: '/election-history', label: t('nav.electionHistory', 'Election History'), icon: BarChart3 },
    { path: '/update', label: t('nav.update'), icon: MapPin },
    { path: '/results', label: t('nav.results'), icon: FileText },
    { path: '/fraud', label: t('nav.fraud'), icon: Shield },
    { path: '/analytics', label: t('nav.analytics'), icon: Activity },
    { path: '/system-logs', label: t('nav.systemLogs'), icon: ScrollText },
  ];
};

// ──────────── NOTIFICATION DROPDOWN ────────────

const useNotifTabs = () => {
  const { t } = useTranslation();
  return [
    { key: 'all', label: t('notifications.tabs.all') },
    { key: 'fraud', label: t('notifications.tabs.fraud') },
    { key: 'voter', label: t('notifications.tabs.voters') },
    { key: 'system', label: t('notifications.tabs.system') },
  ];
};

const NotificationDropdown = ({ notifications, open, onClose, onClear }) => {
  const ref = useRef(null);
  const [tab, setTab] = useState('all');
  const { t } = useTranslation();
  const NOTIF_TABS = useNotifTabs();

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  const getIcon = (type) => {
    if (type === 'fraud') return <ShieldAlert size={14} className="text-red-500 shrink-0" />;
    if (type === 'voter') return <UserCheck size={14} className="text-dash-accent shrink-0" />;
    if (type === 'vote') return <Vote size={14} className="text-dash-success shrink-0" />;
    if (type === 'system' || type === 'success') return <CheckCircle size={14} className="text-dash-success shrink-0" />;
    if (type === 'warning') return <AlertTriangle size={14} className="text-dash-warning shrink-0" />;
    return <Info size={14} className="text-dash-accent shrink-0" />;
  };

  const filtered = tab === 'all'
    ? notifications
    : notifications.filter(n => n.category === tab);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-[420px] rounded-xl shadow-2xl border border-dash-border z-50 animate-slide-down overflow-hidden surface">
      <div className="px-4 py-3 border-b border-dash-border surface-alt">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-bold text-dash-text">{t('notifications.title')}</h3>
          {notifications.length > 0 && (
            <button onClick={onClear} className="text-xs text-dash-accent hover:underline font-medium">{t('notifications.clearAll')}</button>
          )}
        </div>
        <div className="flex gap-1">
          {NOTIF_TABS.map(nt => (
            <button
              key={nt.key}
              onClick={() => setTab(nt.key)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                tab === nt.key ? 'bg-dash-primary text-white' : 'text-dash-text-secondary hover:bg-slate-200'
              }`}
            >
              {nt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell size={24} className="mx-auto text-dash-muted mb-2" />
            <p className="text-sm text-dash-text-secondary">{t('notifications.noNotifications')}</p>
          </div>
        ) : (
          filtered.map((n, i) => (
            <div key={i} className="px-4 py-3 border-b border-dash-border last:border-0 hover:bg-slate-50 transition-colors">
              <div className="flex gap-3">
                {getIcon(n.type)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-dash-text truncate">{n.title}</p>
                  <p className="text-xs text-dash-text-secondary mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-dash-muted mt-1">{n.time}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ──────────── MASTER RESET MODAL ────────────

const MasterResetModal = ({ open, onClose }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  const handleReset = async () => {
    if (input !== 'RESET') {
      setError('Confirmation text must be exactly "RESET"');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/v1/admin/master-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'RESET' })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Reset failed');

      alert('✅ System reset completed successfully. Redirecting to dashboard...');
      setInput('');
      onClose();
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-red-200 bg-red-50 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-900">⚠️ System Reset</h2>
            <p className="text-sm text-red-700 mt-1">This action cannot be undone</p>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900">
            <p className="font-semibold mb-2">This will permanently delete:</p>
            <ul className="list-disc list-inside space-y-1 text-red-800">
              <li>All voter registrations</li>
              <li>All elections and candidates</li>
              <li>All votes and voting records</li>
              <li>All biometric data (Face++)</li>
              <li>Mock blockchain ledger</li>
            </ul>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">Confirmation</label>
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              placeholder='Type "RESET" to confirm'
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              disabled={loading}
            />
            {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReset}
            disabled={input !== 'RESET' || loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            {loading ? 'Resetting...' : 'Confirm Reset'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────── SETTINGS DROPDOWN ────────────

const SettingsDropdown = ({ open, onClose, onMasterReset }) => {
  const ref = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  const items = [
    { icon: User, label: t('settings.profile'), desc: t('settings.profileDesc'), action: () => navigate('/about') },
    { icon: Sliders, label: t('settings.sysConfig'), desc: t('settings.sysConfigDesc'), action: () => navigate('/system-logs') },
    { icon: Shield, label: t('settings.security'), desc: t('settings.securityDesc'), action: () => navigate('/security') },
    { icon: HelpCircle, label: t('settings.help'), desc: t('settings.helpDesc'), action: () => navigate('/help') },
    { divider: true },
    { icon: RotateCcw, label: 'Master Reset', desc: 'Reset entire system to fresh install', action: onMasterReset, danger: true },
    { divider: true },
    { icon: LogOut, label: t('settings.signOut'), desc: t('settings.signOutDesc'), action: () => { alert('Signed out'); }, danger: true },
  ];

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-2xl border border-dash-border z-50 animate-slide-down overflow-hidden surface">
      <div className="px-4 py-3 border-b border-dash-border surface-alt">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-dash-primary rounded-full flex items-center justify-center text-white text-sm font-bold">A</div>
          <div>
            <p className="text-sm font-bold text-dash-text">{t('settings.adminUser')}</p>
            <p className="text-xs text-dash-text-secondary">{t('settings.adminEmail', 'admin@loksetu.gov.in')}</p>
          </div>
        </div>
      </div>
      <div className="py-1">
        {items.map((item, i) =>
          item.divider ? (
            <div key={i} className="border-t border-dash-border my-1" />
          ) : (
            <button
              key={i}
              onClick={() => { item.action(); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${
                item.danger ? 'text-dash-danger' : 'text-dash-text'
              }`}
            >
              <item.icon size={16} className={item.danger ? 'text-dash-danger' : 'text-dash-text-secondary'} />
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-dash-text-secondary">{item.desc}</p>
              </div>
            </button>
          )
        )}
      </div>
    </div>
  );
};

// ──────────── HEADER ────────────

const AppHeader = ({ onMenuClick }) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [masterResetOpen, setMasterResetOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    const es = new EventSource(`${API}/api/v1/monitor/fraud/stream`);
    eventSourceRef.current = es;

    es.addEventListener('fraud-alert', (event) => {
      try {
        const alert = JSON.parse(event.data);
        const notif = {
          type: 'fraud',
          category: 'fraud',
          title: `Fraud Alert: ${alert.type?.replace(/_/g, ' ') || 'Unknown'}`,
          message: alert.message || `Severity: ${alert.severity} | Score: ${alert.score}`,
          time: new Date().toLocaleTimeString(),
        };
        setNotifications(prev => [notif, ...prev].slice(0, 50));
      } catch (_error) {
        // Ignore malformed SSE payloads.
      }
    });

    es.addEventListener('connected', () => {
      setNotifications(prev => [{
        type: 'success',
        category: 'system',
        title: 'Real-time monitoring active',
        message: 'SSE connection established. Live fraud alerts enabled.',
        time: new Date().toLocaleTimeString(),
      }, ...prev].slice(0, 50));
    });

    return () => { es.close(); eventSourceRef.current = null; };
  }, []);

  // Poll audit-log for voter/vote events
  useEffect(() => {
    let lastCount = 0;
    const poll = async () => {
      try {
        const res = await fetch(`${API}/api/v1/monitor/audit-log`);
        if (!res.ok) return;
        const data = await res.json();
        const voters = data.recentActivity || [];
        if (voters.length > lastCount && lastCount > 0) {
          const newOnes = voters.slice(0, voters.length - lastCount);
          const notifs = newOnes.map(v => ({
            type: v.has_voted ? 'vote' : 'voter',
            category: 'voter',
            title: v.has_voted ? `Vote Cast: ${v.full_name}` : `Voter Registered: ${v.full_name}`,
            message: `${v.constituency} • EPIC: ${v.epic_id}`,
            time: new Date().toLocaleTimeString(),
          }));
          setNotifications(prev => [...notifs, ...prev].slice(0, 50));
        }
        lastCount = voters.length;
      } catch (_error) {
        // Ignore transient polling failures.
      }
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.length;
  const { t } = useTranslation();

  return (
    <>
    {/* Tricolor Band - Enhanced Gradient */}
    <div className="tricolor-band sticky top-0 z-40" role="banner" aria-label="National tricolor">
      <div className="h-1.5 bg-gradient-to-r from-dash-saffron via-white to-dash-green" />
    </div>
    <header className="w-full backdrop-blur-md border-b border-dash-border sticky top-[6px] z-30 shadow-sm surface" role="navigation" aria-label="Main navigation">
      {/* Accessibility Bar */}
      <div className="border-b border-slate-200 surface-alt">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between w-full py-1">
          <div className="flex items-center gap-2 text-[10px] text-dash-text-secondary min-w-0">
            <span className="hidden sm:inline font-medium">{t('app.tagline')}</span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <AccessibilityToolbar />
            <div className="w-px h-4 bg-slate-300" />
            <LanguageSelector />
          </div>
        </div>
      </div>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between w-full min-w-0 h-16">
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
            <button onClick={onMenuClick} className="text-dash-text-secondary hover:text-dash-text hover:bg-slate-100 p-2 rounded-lg transition-colors" aria-label="Open navigation drawer" title="Open menu">
              <Menu size={22} />
            </button>
            <Link to="/" className="flex items-center gap-3 flex-shrink-0" aria-label="LokSetu Home">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                <img src="/loksetu-logo.svg" alt="LokSetu Logo" className="w-9 h-9 object-contain" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold text-dash-primary leading-tight">{t('app.name')}</h1>
                <p className="text-[10px] text-dash-text-secondary font-medium -mt-0.5">{t('app.subtitle')}</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-1 min-w-0 flex-shrink-0">

            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); setSettingsOpen(false); }}
                className="relative p-2 rounded-lg text-dash-text-secondary hover:text-dash-text hover:bg-slate-100 transition-colors"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                title="Notifications"
              >
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-dash-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1" aria-hidden="true">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationDropdown
                notifications={notifications}
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                onClear={() => { setNotifications([]); setNotifOpen(false); }}
              />
            </div>

            <div className="relative">
              <button
                onClick={() => { setSettingsOpen(!settingsOpen); setNotifOpen(false); }}
                className="p-2 rounded-lg text-dash-text-secondary hover:text-dash-text hover:bg-slate-100 transition-colors"
                aria-label="Settings"
                title="Settings"
              >
                <Settings size={18} aria-hidden="true" />
              </button>
              <SettingsDropdown open={settingsOpen} onClose={() => { setSettingsOpen(false); }} onMasterReset={() => { setSettingsOpen(false); setMasterResetOpen(true); }} />
              <MasterResetModal open={masterResetOpen} onClose={() => setMasterResetOpen(false)} />
            </div>
          </div>
        </div>
      </div>
    </header>
    </>
  );
};

// ──────────── MOBILE MENU ────────────

const MobileMenu = ({ open, onClose }) => {
  const location = useLocation();
  const navItems = useNavItems();
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 left-0 h-full w-72 z-50 shadow-2xl animate-slide-in-left surface" role="dialog" aria-label="Navigation menu">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dash-border">
          <span className="font-bold text-dash-text">{t('nav.navigation', 'Navigation')}</span>
          <button onClick={onClose} className="text-dash-text-secondary hover:text-dash-text" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className="py-2" aria-label="Mobile navigation">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={onClose}
              className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                location.pathname === path
                  ? 'bg-dash-primary/5 text-dash-primary font-bold border-r-3 border-dash-primary'
                  : 'text-dash-text-secondary hover:bg-slate-50 hover:text-dash-text'
              }`}
              aria-current={location.pathname === path ? 'page' : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 px-5 py-4 border-t border-dash-border surface-alt">
          <div className="flex items-center gap-2 text-xs text-dash-text-secondary">
            <span className="w-2 h-2 bg-dash-success rounded-full" aria-hidden="true" />
            {t('notifications.online', 'System Active')}
          </div>
        </div>
      </div>
    </>
  );
};

// ──────────── BREADCRUMB ────────────

const Breadcrumb = () => {
  const location = useLocation();
  const navItems = useNavItems();
  const { t } = useTranslation();
  const current = navItems.find(n => n.path === location.pathname);

  return (
    <div className="border-b border-dash-border surface" role="navigation" aria-label="Breadcrumb">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center gap-1.5 text-sm">
          <Link to="/" className="text-dash-accent hover:underline font-medium">{t('breadcrumb.home', 'Home')}</Link>
          {current && current.path !== '/' && (
            <>
              <ChevronRight size={14} className="text-dash-muted" aria-hidden="true" />
              <span className="text-dash-text-secondary font-medium">{current.label}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ──────────── FOOTER ────────────

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="footer mt-auto" role="contentinfo">
      <div className="footer-inner max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div>
            <h4 className="text-sm footer-heading mb-3">{t('footer.platform', 'Platform')}</h4>
            <div className="space-y-2">
              <Link to="/about" className="footer-link">{t('footer.about', 'About LokSetu')}</Link>
              <Link to="/" className="footer-link">{t('nav.dashboard')}</Link>
              <Link to="/analytics" className="footer-link">{t('nav.analytics')}</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm footer-heading mb-3">{t('footer.support', 'Support')}</h4>
            <div className="space-y-2">
              <Link to="/help" className="footer-link">{t('footer.helpCenter', 'Help Center')}</Link>
              <Link to="/contact" className="footer-link">{t('footer.contactSupport', 'Contact Support')}</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm footer-heading mb-3">{t('footer.legal', 'Legal')}</h4>
            <div className="space-y-2">
              <Link to="/privacy" className="footer-link">{t('footer.privacy', 'Privacy Policy')}</Link>
              <Link to="/terms" className="footer-link">{t('footer.terms', 'Terms of Service')}</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm footer-heading mb-3">{t('footer.security', 'Security')}</h4>
            <div className="space-y-2">
              <Link to="/security" className="footer-link">{t('footer.securityNotice', 'Security Notice')}</Link>
              <span className="footer-link">{t('footer.aes', 'AES-256 Encrypted')}</span>
              <span className="footer-link">{t('footer.blockchain', 'Blockchain Verified')}</span>
              <span className="footer-link">{t('footer.auditable', 'End-to-End Auditable')}</span>
            </div>
          </div>
        </div>
        <div className="footer-bottom flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span>© 2026 LokSetu Platform</span>
          <span>Built with Hyperledger Fabric • Secured by AI</span>
        </div>
      </div>
    </footer>
  );
};

// ──────────── FOOTER PAGES ────────────

const HelpPage = () => (
  <div className="space-y-6 animate-fade-in max-w-3xl">
    <h2 className="section-title">Help Center</h2>
    <div className="dash-card p-6 space-y-5">
      <div>
        <h3 className="font-bold text-dash-text mb-2">Getting Started</h3>
        <p className="text-sm text-dash-text-secondary leading-relaxed">LokSetu is a blockchain-based electronic voting platform. As an administrator, you can register voters, monitor elections, detect fraud, and view live results.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Voter Registration</h3>
        <p className="text-sm text-dash-text-secondary leading-relaxed">Navigate to <strong>Registration Requests</strong> to review voter self-enrollment submissions from the voter panel. Approve requests to complete registration or reject invalid entries.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Fraud Detection</h3>
        <p className="text-sm text-dash-text-secondary leading-relaxed">The platform uses 7 AI-powered fraud detection engines: Duplicate Attempt, Velocity Anomaly, IP Clustering, Bot Detection, Device Fingerprinting, Graph Network Analysis, and Behavioral AI. Alerts appear in real-time on the Fraud Monitor dashboard.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Live Results</h3>
        <p className="text-sm text-dash-text-secondary leading-relaxed">Results are tallied directly from the Hyperledger Fabric blockchain, ensuring immutability. Each vote is a blockchain transaction that cannot be altered after commitment.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">System Health</h3>
        <p className="text-sm text-dash-text-secondary leading-relaxed">The Dashboard shows real-time health of all system components: Database, Blockchain Gateway, Kafka, and AI services. Green indicators mean operational; red means attention needed.</p>
      </div>
    </div>
  </div>
);

const ContactPage = () => (
  <div className="space-y-6 animate-fade-in max-w-3xl">
    <h2 className="section-title">Contact Support</h2>
    <div className="dash-card p-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Mail size={18} className="text-dash-accent mt-0.5" />
            <div>
              <p className="text-sm font-bold text-dash-text">Email Support</p>
              <p className="text-sm text-dash-text-secondary">support@loksetu-platform.gov.in</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <HelpCircle size={18} className="text-dash-accent mt-0.5" />
            <div>
              <p className="text-sm font-bold text-dash-text">Technical Support</p>
              <p className="text-sm text-dash-text-secondary">Available 24/7 during election periods</p>
            </div>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-dash-text mb-3">Send a Message</p>
          <div className="space-y-3">
            <input type="text" placeholder="Subject" className="dash-input" />
            <textarea placeholder="Describe your issue..." rows={4} className="dash-input resize-none" />
            <button className="btn-primary text-sm px-5 py-2.5">Send Message</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PrivacyPage = () => (
  <div className="space-y-6 animate-fade-in max-w-3xl">
    <h2 className="section-title">Privacy Policy</h2>
    <div className="dash-card p-6 space-y-5 text-sm text-dash-text-secondary leading-relaxed">
      <div>
        <h3 className="font-bold text-dash-text mb-2">Data Collection</h3>
        <p>LokSetu collects voter biometric data (facial embeddings), EPIC IDs, constituency information, and voting records. All data is processed solely for election administration and fraud prevention.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Data Security</h3>
        <p>All data is encrypted using AES-256. Biometric data is stored as mathematical embeddings in Face++ cloud with no raw images retained. Database connections use TLS encryption. Vote records are immutably stored on Hyperledger Fabric blockchain.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Data Retention</h3>
        <p>Voter records are retained for the duration mandated by the Election Commission. Fraud detection logs are kept for audit purposes. Behavioral data is anonymized after analysis.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Third-Party Services</h3>
        <p>Face++ (Megvii) is used for biometric verification. OpenAI is used for the admin AI assistant. No voter data is shared with third parties beyond what is required for these services.</p>
      </div>
    </div>
  </div>
);

const TermsPage = () => (
  <div className="space-y-6 animate-fade-in max-w-3xl">
    <h2 className="section-title">Terms of Service</h2>
    <div className="dash-card p-6 space-y-5 text-sm text-dash-text-secondary leading-relaxed">
      <div>
        <h3 className="font-bold text-dash-text mb-2">Platform Usage</h3>
        <p>LokSetu is an authorized election management platform. Access is restricted to designated election administrators with valid credentials. Unauthorized access attempts are logged and reported.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Administrator Responsibilities</h3>
        <p>Administrators must ensure accurate voter data entry, monitor fraud alerts promptly, and maintain the integrity of the election process. Any detected irregularities must be reported immediately.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Blockchain Immutability</h3>
        <p>Once a vote is recorded on the Hyperledger Fabric blockchain, it cannot be modified or deleted. This ensures complete electoral integrity and auditability.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Liability</h3>
        <p>The LokSetu platform is provided as-is for election administration. While every effort is made for accuracy and security, administrators should verify results through official channels.</p>
      </div>
    </div>
  </div>
);

const AboutPage = () => (
  <div className="space-y-6 animate-fade-in max-w-3xl">
    <h2 className="section-title">About LokSetu</h2>
    <div className="dash-card p-6 space-y-5">
      <div>
        <h3 className="font-bold text-dash-text mb-2">What is LokSetu?</h3>
        <p className="text-sm text-dash-text-secondary leading-relaxed">LokSetu (Secure Digital Election Bridge) is a next-generation blockchain-based electronic voting platform designed to bring transparency, security, and verifiability to democratic elections.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Technology Stack</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Hyperledger Fabric', 'Immutable vote ledger'],
            ['Face++ AI', 'Biometric verification'],
            ['Apache Kafka', 'Real-time event streaming'],
            ['PostgreSQL', 'Voter data management'],
            ['React + TailwindCSS', 'Modern admin interface'],
            ['7 AI Fraud Engines', 'Multi-layer security'],
          ].map(([tech, desc]) => (
            <div key={tech} className="px-3 py-2 bg-slate-50 rounded-lg border border-dash-border">
              <p className="text-sm font-semibold text-dash-text">{tech}</p>
              <p className="text-xs text-dash-text-secondary">{desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Mission</h3>
        <p className="text-sm text-dash-text-secondary leading-relaxed">To eliminate election fraud, reduce costs, and increase voter participation through cutting-edge blockchain technology and AI-powered security systems.</p>
      </div>
    </div>
  </div>
);

const SecurityNoticePage = () => (
  <div className="space-y-6 animate-fade-in max-w-3xl">
    <h2 className="section-title">Security Notice</h2>
    <div className="dash-card p-6 space-y-5 text-sm text-dash-text-secondary leading-relaxed">
      <div>
        <h3 className="font-bold text-dash-text mb-2">Encryption Standards</h3>
        <p>All data transmitted between clients and the LokSetu platform is encrypted using TLS 1.3. Database records are encrypted at rest using AES-256. Biometric Face++ embeddings are stored using one-way mathematical representations that cannot be reverse-engineered into facial images.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Blockchain Integrity</h3>
        <p>Each vote is committed to the Hyperledger Fabric blockchain as an immutable transaction. The consensus mechanism ensures that no single node can alter election records. All transactions are cryptographically signed and can be independently verified.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">AI Fraud Detection</h3>
        <p>LokSetu employs 7 independent fraud detection engines operating in real-time: Duplicate Attempt Detection, Velocity Anomaly Analysis, IP Clustering, Bot Detection via behavioral analysis, Device Fingerprinting, Graph Network Analysis, and Behavioral AI. Each engine produces a risk score that feeds into a composite fraud alert system.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Access Control</h3>
        <p>Administrator access is protected by JWT-based authentication with token expiry. All API endpoints are rate-limited to prevent abuse. IP addresses are tracked and suspicious patterns are flagged automatically. Session tokens are rotated on each authentication event.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Audit Trail</h3>
        <p>Every action on the platform — voter registration, vote casting, fraud detection, and administrative operations — is logged in the system audit trail. Logs are tamper-evident and retained for the full election cycle as mandated by the Election Commission of India.</p>
      </div>
      <div>
        <h3 className="font-bold text-dash-text mb-2">Vulnerability Reporting</h3>
        <p>If you discover a security vulnerability, please report it responsibly to security@loksetu-platform.gov.in. Do not publicly disclose vulnerabilities before they have been addressed.</p>
      </div>
    </div>
  </div>
);

// ──────────── APP ────────────

function AppContent() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="admin-root min-h-screen bg-dash-surface flex flex-col font-sans overflow-x-hidden">
      <AppHeader onMenuClick={() => setMenuOpen(true)} />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <Breadcrumb />

      <main className="flex-grow px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto animate-fade-in">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/registration-requests" element={<RegistrationRequests />} />
          <Route path="/election-setup" element={<ElectionSetup />} />
          <Route path="/election-history" element={<ElectionHistory />} />
          <Route path="/update" element={<UpdateConstituency />} />
          <Route
            path="/results"
            element={
              <ErrorBoundary>
                <Result />
              </ErrorBoundary>
            }
          />
          <Route
            path="/results/:election_id"
            element={
              <ErrorBoundary>
                <Result />
              </ErrorBoundary>
            }
          />
          <Route path="/fraud" element={<FraudMonitor />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/system-logs" element={<SystemLogs />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/security" element={<SecurityNoticePage />} />
        </Routes>
      </main>

      <Footer />
      <Chatbot />
    </div>
  );
}

function App() {
  return (
    <AccessibilityProvider>
      <ThemeProvider>
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AccessibilityProvider>
  );
}

export default App;
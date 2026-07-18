import { useState, useEffect, useCallback } from 'react';
import { X, Wifi, WifiOff, RefreshCw, ExternalLink } from 'lucide-react';
import teamsService from '../services/teamsService';

// Teams logo inline SVG
function TeamsIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.25 5.25a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" fill="#6264A7"/>
      <path d="M18.75 7.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" fill="#6264A7"/>
      <path d="M19.5 10.5h-3a.75.75 0 0 0-.75.75v4.5a3 3 0 0 1-1.5 2.598V19.5a.75.75 0 0 0 .75.75H19.5a.75.75 0 0 0 .75-.75v-9a.75.75 0 0 0-.75-.75Z" fill="#6264A7"/>
      <path d="M14.25 10.5H9.75A.75.75 0 0 0 9 11.25v6A3.75 3.75 0 0 0 12.75 21 3.75 3.75 0 0 0 16.5 17.25v-6a.75.75 0 0 0-.75-.75Z" fill="#464775"/>
    </svg>
  );
}

function ComingSoonBadge() {
  return (
    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
      Soon
    </span>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-indigo-500' : 'bg-white/15'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function ConnectionsModal({ onClose }) {
  const [status, setStatus] = useState({
    connected: false,
    connectedEmail: '',
    connectedAt: null,
    showInChronicle: true,
  });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await teamsService.getTeamsStatus();
      setStatus({
        connected: Boolean(s.connected),
        connectedEmail: s.connectedEmail || '',
        connectedAt: s.connectedAt || null,
        showInChronicle: s.showInChronicle !== false,
      });
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const result = await teamsService.connectTeams();
      if (result.success) {
        await loadStatus();
      }
    } catch (err) {
      setError(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError('');
    try {
      await teamsService.disconnectTeams();
      setStatus({ connected: false, connectedEmail: '', connectedAt: null, showInChronicle: true });
    } catch (err) {
      setError(err.message || 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggle = async (val) => {
    setToggling(true);
    setStatus((prev) => ({ ...prev, showInChronicle: val }));
    try {
      await teamsService.toggleTeamsInChronicle(val);
    } catch {
      setStatus((prev) => ({ ...prev, showInChronicle: !val }));
    } finally {
      setToggling(false);
    }
  };

  const connectedDate = status.connectedAt
    ? new Date(status.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0d0d] border border-white/12 rounded-2xl w-full max-w-md shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-white/8 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">Connections</h2>
            <p className="text-xs text-gray-500 mt-0.5">Link external calendars and services</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cards */}
        <div className="p-5 space-y-3">

          {/* ── Microsoft Teams ── */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#6264A7]/20 border border-[#6264A7]/30 flex items-center justify-center flex-shrink-0">
                  <TeamsIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Microsoft Teams</p>
                  <p className="text-[11px] text-gray-500">Outlook Calendar · Work meetings</p>
                </div>
              </div>

              {/* Connected dot */}
              {!loading && (
                <div className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full border ${
                  status.connected
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-gray-500 bg-white/5 border-white/10'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${status.connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                  {status.connected ? 'Connected' : 'Not connected'}
                </div>
              )}
            </div>

            {/* Connected detail */}
            {!loading && status.connected && (
              <div className="bg-black/30 border border-white/8 rounded-lg px-3 py-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Wifi className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                  <span className="text-xs text-indigo-300 font-medium truncate">{status.connectedEmail}</span>
                </div>
                {connectedDate && (
                  <p className="text-[10px] text-gray-600">Connected {connectedDate}</p>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-white/8">
                  <span className="text-[11px] text-gray-400">Show in Chronicle</span>
                  <Toggle
                    checked={status.showInChronicle}
                    onChange={handleToggle}
                    disabled={toggling}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-0.5">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Loading…
                </div>
              ) : status.connected ? (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#6264A7]/70 hover:bg-[#6264A7] border border-[#6264A7]/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  <ExternalLink className="w-3 h-3" />
                  {connecting ? 'Connecting…' : 'Connect Work Calendar'}
                </button>
              )}
            </div>
          </div>

          {/* ── Google Calendar (Coming Soon) ── */}
          <div className="rounded-xl border border-white/8 bg-white/[0.01] p-4 opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-base">
                  📅
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">Google Calendar</p>
                    <ComingSoonBadge />
                  </div>
                  <p className="text-[11px] text-gray-500">Google Workspace · Personal events</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Notion (Coming Soon) ── */}
          <div className="rounded-xl border border-white/8 bg-white/[0.01] p-4 opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-base">
                  ◻️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">Notion</p>
                    <ComingSoonBadge />
                  </div>
                  <p className="text-[11px] text-gray-500">Notion databases · Tasks &amp; reminders</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <p className="text-[10px] text-gray-600 text-center leading-relaxed">
            Connections use OAuth 2.0. Memora only reads calendar data — it never modifies your calendars.
          </p>
        </div>
      </div>
    </div>
  );
}

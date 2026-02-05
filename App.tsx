

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Terminal, 
  ExternalLink,
  ShieldAlert,
  FileText
} from 'lucide-react';
import { Dashboard } from './components/Dashboard.tsx';
import { Configuration } from './components/Configuration.tsx';
import { InstallationGuide } from './components/InstallationGuide.tsx';
import { MonitorConfig, ServerStats } from './types.ts';

const INITIAL_CONFIG: MonitorConfig = {
  customerName: "AN-Group Client",
  memoryThresholdGB: 3.0,
  partitions: [
    { path: '/', enabled: true, threshold: 90 },
    { path: '/hana/data', enabled: true, threshold: 90 },
    { path: '/hana/shared', enabled: true, threshold: 85 },
    { path: '/hana/log', enabled: true, threshold: 85 },
    { path: '/usr/sap', enabled: true, threshold: 90 },
  ],
  email: {
    smtpServer: "smtp.an-group.one",
    port: 587,
    useTLS: true,
    username: "monitor@an-group.one",
    token: "",
    recipients: "",
    subjectTemplate: "{type} Alert: {customer} on {server}",
    alertCooldownHours: 6
  },
  intervals: {
    ram: 5,
    disk: 10,
    process: 5
  }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config' | 'install' | 'logs'>('dashboard');
  const [config, setConfig] = useState<MonitorConfig>(INITIAL_CONFIG);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch stats periodically
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
          setIsConnected(true);
        }
      } catch (error) {
        setIsConnected(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch configuration whenever entering the config tab
  useEffect(() => {
    if (activeTab === 'config') {
      const fetchConfig = async () => {
        try {
          const response = await fetch('/load-config');
          if (response.ok) {
            const data = await response.json();
            setConfig(data);
          }
        } catch (error) {
          console.error("Failed to fetch configuration:", error);
        }
      };
      fetchConfig();
    }
  }, [activeTab]);

  const handleSaveConfig = async (newConfig: MonitorConfig) => {
    try {
      const response = await fetch('/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      
      if (response.ok) {
        setConfig(newConfig);
        alert("Configuration saved & Agent updated successfully.");
      } else {
        alert("Failed to save configuration.");
      }
    } catch (error) {
      alert("Could connect to Agent to save settings.");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <aside className="w-full lg:w-72 bg-[#004D60] text-white flex flex-col shadow-xl">
        <div className="p-8 border-b border-[#006680]">
          <div className="flex flex-col items-center gap-4 mb-4">
            <div className="bg-white p-3 rounded-lg w-full">
                <img 
                  src="https://www.an-group.one/wp-content/uploads/2025/08/ANG-Logo-International-1-300x133.png" 
                  alt="ANG Logo" 
                  className="w-full h-auto"
                />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold tracking-tight uppercase">ANG Monitor</h1>
              <p className="text-[10px] text-teal-300 font-bold tracking-widest">SLES Enterprise Edition</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Live Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={<Settings size={20} />} label="Configuration" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
          <SidebarItem icon={<FileText size={20} />} label="System Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <SidebarItem icon={<Terminal size={20} />} label="Installation Guide" active={activeTab === 'install'} onClick={() => setActiveTab('install')} />
        </nav>

        <div className="p-6 mt-auto bg-[#003B4A] text-[10px] space-y-1">
          <p className="font-semibold text-teal-400 uppercase tracking-widest">Produced by:</p>
          <a href="https://www.an-group.one" target="_blank" className="text-white hover:text-[#F2A900] flex items-center gap-1 transition-colors">
            AN-Group One <ExternalLink size={10} />
          </a>
          <p className="mt-2 text-teal-400 uppercase tracking-widest">Created by:</p>
          <p className="text-white italic">Maen Abu-Tanabanjeh</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'dashboard' && 'Server Health Overview'}
              {activeTab === 'config' && 'Monitoring Configuration'}
              {activeTab === 'logs' && 'System Activity Logs'}
              {activeTab === 'install' && 'Service Installation'}
            </h2>
          </div>

          <div className="flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-slate-600">{isConnected ? 'Agent Online' : 'Agent Offline'}</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Server IP</span>
              <span className="text-sm font-mono text-slate-700">{stats?.ipAddress || 'Checking...'}</span>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && stats && <Dashboard stats={stats} config={config} />}
        {activeTab === 'config' && <Configuration config={config} onSave={handleSaveConfig} />}
        {activeTab === 'logs' && <div className="bg-slate-900 text-teal-400 p-6 rounded-2xl font-mono text-xs h-[600px] overflow-y-auto shadow-xl border border-slate-800">Please refer to the "System Logs" tab in the static index.html or access /logs directly.</div>}
        {activeTab === 'install' && <InstallationGuide />}
        
        {!stats && activeTab === 'dashboard' && (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
            <ShieldAlert size={48} className="mb-4 text-slate-200" />
            <p>Waiting for Agent data...</p>
            <p className="text-xs mt-2">Ensure Port 9090 is open on your firewall.</p>
          </div>
        )}
      </main>
    </div>
  );
};

const SidebarItem: React.FC<{icon: any, label: string, active: boolean, onClick: () => void}> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-[#F2A900] text-slate-900 shadow-md font-semibold' : 'text-slate-300 hover:bg-[#006680] hover:text-white'}`}>
    <span className={`${active ? 'text-slate-900' : 'text-[#F2A900]'}`}>{icon}</span>
    {label}
  </button>
);

export default App;
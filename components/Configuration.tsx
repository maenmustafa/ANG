

import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Trash2, 
  Plus, 
  Mail, 
  HardDrive, 
  Settings2, 
  User, 
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Clock,
  RefreshCw,
  Users,
  BellOff
} from 'lucide-react';
import { MonitorConfig, PartitionConfig } from '../types';

interface ConfigurationProps {
  config: MonitorConfig;
  onSave: (config: MonitorConfig) => void;
}

export const Configuration: React.FC<ConfigurationProps> = ({ config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<MonitorConfig>({
    ...config,
    intervals: config.intervals || { ram: 5, disk: 10, process: 5 }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update local state if the parent config changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/load-config');
      if (response.ok) {
        const data = await response.json();
        setLocalConfig(data);
      }
    } catch (error) {
      console.error("Failed to refresh config:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handlePartitionToggle = (index: number) => {
    const updatedPartitions = [...localConfig.partitions];
    updatedPartitions[index].enabled = !updatedPartitions[index].enabled;
    setLocalConfig({ ...localConfig, partitions: updatedPartitions });
  };

  const handlePartitionThreshold = (index: number, value: string) => {
    const val = parseInt(value) || 0;
    const updatedPartitions = [...localConfig.partitions];
    updatedPartitions[index].threshold = val;
    setLocalConfig({ ...localConfig, partitions: updatedPartitions });
  };

  const handleAddPartition = () => {
    const path = prompt("Enter Partition Path (e.g. /hana/shared):");
    if (path) {
      setLocalConfig({
        ...localConfig,
        partitions: [...localConfig.partitions, { path, enabled: true, threshold: 90 }]
      });
    }
  };

  const handleRemovePartition = (index: number) => {
    const updated = localConfig.partitions.filter((_, i) => i !== index);
    setLocalConfig({ ...localConfig, partitions: updated });
  };

  const handleSave = () => {
    // Validate and clean numeric inputs to avoid sending NaN/null to Python agent
    const validatedConfig: MonitorConfig = {
      ...localConfig,
      memoryThresholdGB: isNaN(localConfig.memoryThresholdGB) ? 2.0 : localConfig.memoryThresholdGB,
      email: {
        ...localConfig.email,
        port: isNaN(localConfig.email.port) ? 587 : localConfig.email.port,
        alertCooldownHours: isNaN(localConfig.email.alertCooldownHours) ? 6 : localConfig.email.alertCooldownHours
      }
    };
    onSave(validatedConfig);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Configuration Control Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Settings2 className="text-[#004D60]" size={24} />
          <div>
            <h3 className="font-bold text-slate-800">Monitor Settings</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manage alert thresholds & sync</p>
          </div>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Syncing...' : 'Refresh from Server'}
        </button>
      </div>

      {/* General Settings */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-[#004D60] text-white flex items-center gap-3">
          <User size={20} />
          <h3 className="font-bold">General Information</h3>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Customer Name</label>
            <input 
              type="text" 
              value={localConfig.customerName}
              onChange={(e) => setLocalConfig({...localConfig, customerName: e.target.value})}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#006680] outline-none transition-all"
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Memory Warning (Free GB)</label>
            <div className="relative">
              <input 
                type="number" 
                value={localConfig.memoryThresholdGB}
                onChange={(e) => setLocalConfig({...localConfig, memoryThresholdGB: parseFloat(e.target.value)})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#006680] outline-none transition-all"
              />
              <span className="absolute right-3 top-2 text-slate-400 font-bold text-sm">GB</span>
            </div>
          </div>
        </div>
      </section>

      {/* Email SMTP Settings */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-[#004D60] text-white flex items-center gap-3">
          <Mail size={20} />
          <h3 className="font-bold">Email Alert Delivery (SMTP)</h3>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Mail Server (SMTP)</label>
              <input 
                type="text" 
                value={localConfig.email.smtpServer}
                onChange={(e) => setLocalConfig({
                  ...localConfig, 
                  email: {...localConfig.email, smtpServer: e.target.value}
                })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#006680] outline-none"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Port</label>
              <input 
                type="number" 
                value={localConfig.email.port}
                onChange={(e) => setLocalConfig({
                  ...localConfig, 
                  email: {...localConfig.email, port: parseInt(e.target.value)}
                })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#006680] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Username / Address</label>
              <input 
                type="text" 
                value={localConfig.email.username}
                onChange={(e) => setLocalConfig({
                  ...localConfig, 
                  email: {...localConfig.email, username: e.target.value}
                })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#006680] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Token / Password</label>
              <input 
                type="password" 
                value={localConfig.email.token}
                onChange={(e) => setLocalConfig({
                  ...localConfig, 
                  email: {...localConfig.email, token: e.target.value}
                })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#006680] outline-none"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Users size={16} className="text-[#006680]" />
              Recipient Email Addresses (comma separated)
            </label>
            <textarea 
              rows={2}
              value={localConfig.email.recipients}
              onChange={(e) => setLocalConfig({
                ...localConfig, 
                email: {...localConfig.email, recipients: e.target.value}
              })}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#006680] outline-none text-sm font-mono"
              placeholder="admin@example.com, monitor@example.com"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
             <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <BellOff size={16} className="text-orange-500" />
                  Alert Cooldown (Repeat Delay)
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    value={localConfig.email.alertCooldownHours}
                    onChange={(e) => setLocalConfig({
                      ...localConfig, 
                      email: {...localConfig.email, alertCooldownHours: parseFloat(e.target.value)}
                    })}
                    className="w-24 px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#006680] outline-none"
                  />
                  <span className="text-sm font-bold text-slate-500">HOURS</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 italic">Prevents inbox flooding. If an issue persists, wait X hours before re-alerting.</p>
             </div>
             <div className="flex items-center gap-2 self-end pb-2">
                <input 
                  type="checkbox" 
                  checked={localConfig.email.useTLS}
                  onChange={(e) => setLocalConfig({
                    ...localConfig, 
                    email: {...localConfig.email, useTLS: e.target.checked}
                  })}
                  className="w-5 h-5 accent-[#006680]"
                />
                <label className="text-sm font-semibold text-slate-700">Use Secure TLS Connection</label>
             </div>
          </div>
        </div>
      </section>

      {/* Monitoring Frequency */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-[#004D60] text-white flex items-center gap-3">
          <Clock size={20} />
          <h3 className="font-bold">Monitoring Frequency (Check Rates)</h3>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Check RAM Every</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={localConfig.intervals?.ram || 5}
                onChange={(e) => setLocalConfig({...localConfig, intervals: {...(localConfig.intervals || {ram:5, disk:10, process:5}), ram: parseInt(e.target.value) || 1}})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
              <span className="text-xs font-bold text-slate-400">MIN</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Check Disk Every</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={localConfig.intervals?.disk || 10}
                onChange={(e) => setLocalConfig({...localConfig, intervals: {...(localConfig.intervals || {ram:5, disk:10, process:5}), disk: parseInt(e.target.value) || 1}})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
              <span className="text-xs font-bold text-slate-400">MIN</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Log Top 10 Every</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={localConfig.intervals?.process || 5}
                onChange={(e) => setLocalConfig({...localConfig, intervals: {...(localConfig.intervals || {ram:5, disk:10, process:5}), process: parseInt(e.target.value) || 1}})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
              <span className="text-xs font-bold text-slate-400">MIN</span>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Action Bar */}
      <div className="sticky bottom-8 left-0 right-0 flex justify-center z-10">
        <button 
          onClick={handleSave}
          className="bg-[#006680] text-white px-10 py-4 rounded-full shadow-2xl flex items-center gap-3 font-bold hover:scale-105 active:scale-95 transition-all"
        >
          <Save size={20} />
          Apply & Save Configuration
        </button>
      </div>
    </div>
  );
};
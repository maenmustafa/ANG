import React, { useState } from 'react';
import { 
  Terminal, 
  Copy, 
  CheckCircle2, 
  ShieldCheck,
  Globe,
  Download,
  Server
} from 'lucide-react';

export const InstallationGuide: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const oneLineCommand = "wget -qO- https://raw.githubusercontent.com/YOUR_GIT_USER/YOUR_REPO/main/install.sh | sudo bash";

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Hero Section */}
      <div className="bg-[#004D60] text-white p-10 rounded-3xl shadow-2xl border border-[#006680] relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <ShieldCheck size={40} className="text-[#F2A900]" />
            <h2 className="text-3xl font-black">Automated Deployment</h2>
          </div>
          <p className="text-teal-100 text-lg max-w-2xl">
            Deploy the ANG Server Monitor to any SLES server in seconds using our automated installation script.
          </p>
        </div>
        <div className="absolute -right-20 -bottom-20 opacity-10">
            <Server size={300} />
        </div>
      </div>

      {/* One-Line Installer */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Terminal size={24} className="text-[#004D60]" />
          Quick One-Line Installation
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Run this command on your SLES server as root. It will install dependencies, download the app from Git, and set up the systemd service.
        </p>
        <div className="bg-slate-900 rounded-2xl p-6 relative group border-4 border-slate-800">
          <code className="text-[#F2A900] font-mono text-sm break-all pr-12 block">
            {oneLineCommand}
          </code>
          <button 
            onClick={() => copyToClipboard(oneLineCommand, "oneline")}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-800 p-3 rounded-xl text-white hover:bg-slate-700 transition-all shadow-lg"
          >
            {copied === "oneline" ? <CheckCircle2 className="text-green-400" /> : <Copy size={20} />}
          </button>
        </div>
        <div className="mt-6 flex gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <Globe className="text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
                <strong>Note:</strong> Replace <code>YOUR_GIT_USER/YOUR_REPO</code> in the command above with your actual GitHub path before sharing this with your clients.
            </p>
        </div>
      </section>

      {/* Manual Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Download size={20} className="text-[#F2A900]" />
                What happens during install?
            </h3>
            <ul className="space-y-4 text-xs text-slate-600 font-medium">
                <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] shrink-0">1</span>
                    Installs <code>python3-psutil</code> via Zypper.
                </li>
                <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] shrink-0">2</span>
                    Creates <code>/ang_monitor</code> application directory.
                </li>
                <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] shrink-0">3</span>
                    Downloads all <code>.tsx</code> and <code>.py</code> files from Git.
                </li>
                <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] shrink-0">4</span>
                    Registers <code>ang-monitor.service</code> in Systemd.
                </li>
            </ul>
        </section>

        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Server size={20} className="text-[#F2A900]" />
                Service Management
            </h3>
            <div className="space-y-3">
                {/* Replaced 'class' with 'className' */}
                <div className="p-3 bg-slate-50 rounded-lg">
                    {/* Replaced 'class' with 'className' */}
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Check Status</p>
                    {/* Replaced 'class' with 'className' */}
                    <code className="text-xs text-[#004D60] font-bold">systemctl status ang-monitor</code>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Restart Service</p>
                    <code className="text-xs text-[#004D60] font-bold">systemctl restart ang-monitor</code>
                </div>
                {/* Replaced 'class' with 'className' */}
                <div className="p-3 bg-slate-50 rounded-lg">
                    {/* Replaced 'class' with 'className' */}
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">View Live Logs</p>
                    {/* Replaced 'class' with 'className' */}
                    <code className="text-xs text-[#004D60] font-bold">tail -f /ang_monitor/monitor.log</code>
                </div>
            </div>
        </section>
      </div>

      {/* Footer info */}
      <div className="text-center text-slate-400 py-8">
        <p className="text-sm font-bold uppercase tracking-widest">ANG Server Monitor v2.1</p>
        <p className="text-xs mt-1">SLES Optimized Monitoring Engine</p>
      </div>
    </div>
  );
};
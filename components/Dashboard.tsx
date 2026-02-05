
import React from 'react';
import { 
  MemoryStick as Memory, 
  HardDrive, 
  Activity, 
  ShieldCheck,
  Zap
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { ServerStats, MonitorConfig } from '../types';

interface DashboardProps {
  stats: ServerStats;
  config: MonitorConfig;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, config }) => {
  const isMemoryCritical = stats.memoryFree < config.memoryThresholdGB;
  
  const diskData = stats.diskStats.map(d => {
    const partitionConfig = config.partitions.find(p => p.path === d.path);
    const threshold = partitionConfig?.threshold || 90;
    return {
      ...d,
      usagePercent: d.usage_pct,
      isCritical: d.usage_pct > threshold,
      threshold
    };
  });

  const memoryData = [
    { name: 'Used', value: stats.memoryTotal - stats.memoryFree, color: '#006680' },
    { name: 'Free', value: stats.memoryFree, color: isMemoryCritical ? '#ef4444' : '#10b981' }
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Memory Health (Free)" 
          value={`${stats.memoryFree.toFixed(1)} GB`}
          subValue={`of ${stats.memoryTotal} GB Total`}
          icon={<Memory className={isMemoryCritical ? 'text-red-500' : 'text-teal-600'} />}
          trend={isMemoryCritical ? 'Critical' : 'Healthy'}
          trendColor={isMemoryCritical ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}
        />
        <StatCard 
          title="Partition Health" 
          value={diskData.filter(d => !d.isCritical).length.toString()}
          subValue={`${diskData.length} Monitored Paths`}
          icon={<HardDrive className="text-teal-600" />}
          trend={`${diskData.filter(d => d.isCritical).length} Alerts`}
          trendColor={diskData.some(d => d.isCritical) ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}
        />
        <StatCard 
          title="Kernel Status" 
          value={stats.oomDetected ? "OOM Event" : "Optimal"}
          subValue={stats.oomDetected ? "Check logs immediately" : "No OOM detected"}
          icon={<ShieldCheck className={stats.oomDetected ? 'text-red-500' : 'text-teal-600'} />}
          trend={stats.oomDetected ? 'ALARM' : 'OK'}
          trendColor={stats.oomDetected ? 'bg-red-500 text-white' : 'bg-emerald-100 text-emerald-600'}
        />
        <StatCard 
          title="Swap Activity" 
          value={`${stats.swapUsagePct}%`}
          subValue="Virtual Memory Usage"
          icon={<Zap className="text-teal-600" />}
          trend={stats.swapUsagePct > 10 ? 'High' : 'Stable'}
          trendColor={stats.swapUsagePct > 10 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Memory Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Activity className="text-[#F2A900]" size={20} />
            Memory Allocation (GB)
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={memoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {memoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around mt-4">
            <div className="text-center">
              <p className="text-sm text-slate-500 uppercase font-bold text-[10px]">Free Space</p>
              <p className={`text-xl font-bold ${isMemoryCritical ? 'text-red-500' : 'text-green-500'}`}>
                {stats.memoryFree.toFixed(2)} GB
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500 uppercase font-bold text-[10px]">Used Space</p>
              <p className="text-xl font-bold text-slate-700">
                {(stats.memoryTotal - stats.memoryFree).toFixed(2)} GB
              </p>
            </div>
          </div>
        </div>

        {/* Disk Partition Usage */}
        <div className="xl:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <HardDrive className="text-[#F2A900]" size={20} />
            Partition Monitoring (% Used)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diskData} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis dataKey="path" type="category" />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Capacity Used']}
                />
                <Bar dataKey="usagePercent" radius={[0, 4, 4, 0]} barSize={24}>
                  {diskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isCritical ? '#ef4444' : '#006680'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            {diskData.map((d, i) => (
               <div key={i} className="text-[10px] p-2 bg-slate-50 rounded border border-slate-100">
                  <p className="font-black text-slate-700 truncate">{d.path}</p>
                  <p className="text-slate-400 font-bold uppercase">Free: {d.free.toFixed(1)} GB</p>
                  <p className={d.isCritical ? 'text-red-500 font-bold' : 'text-teal-600 font-bold'}>{d.usagePercent.toFixed(1)}% Used</p>
               </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Processes Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-[#F2A900]" size={20} />
            Top 10 Memory Consuming Processes
          </h3>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Live Updates</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">PID</th>
                <th className="px-6 py-4">Process Name</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Memory Usage (GB)</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.topProcesses.map((proc, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-400">{proc.pid}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{proc.name}</td>
                  <td className="px-6 py-4 text-slate-500">{proc.user}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{proc.memGB.toFixed(2)} GB</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      proc.memGB > 5 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {proc.memGB > 5 ? 'High Load' : 'Stable'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  subValue: string;
  icon: React.ReactNode;
  trend: string;
  trendColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subValue, icon, trend, trendColor }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${trendColor}`}>
        {trend}
      </span>
    </div>
    <div>
      <h4 className="text-xs font-medium text-slate-400 mb-1">{title}</h4>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <p className="text-xs text-slate-400 mt-1">{subValue}</p>
    </div>
  </div>
);
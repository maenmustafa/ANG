

export interface PartitionConfig {
  path: string;
  enabled: boolean;
  threshold: number; // percentage
}

export interface EmailSettings {
  smtpServer: string;
  port: number;
  useTLS: boolean;
  username: string;
  token: string;
  recipients: string; // Comma-separated list of emails
  subjectTemplate: string;
  alertCooldownHours: number; // Hours to wait before re-sending same alert
}

export interface MonitorConfig {
  customerName: string;
  memoryThresholdGB: number;
  partitions: PartitionConfig[];
  email: EmailSettings;
  intervals: {
    ram: number;     // minutes
    disk: number;    // minutes
    process: number; // minutes
  };
}

export interface ProcessInfo {
  pid: number;
  name: string;
  memGB: number;
  user: string;
}

export interface ServerStats {
  ipAddress: string;
  memoryTotal: number;
  memoryFree: number;
  diskStats: {
    path: string;
    total: number;
    used: number;
    free: number;
    usage_pct: number;
  }[];
  topProcesses: ProcessInfo[];
  lastUpdate: string;
  oomDetected: boolean;
  swapUsagePct: number;
}
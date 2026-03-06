'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Droplets, Users, Wallet, Activity } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Footer } from '@/components/Footer';
import { TOKEN_SYMBOL } from '@/lib/constants';

type DailyMetric = {
  date: string;
  drips: number;
  wallets: number;
  balance: string | null;
};

type DripLog = {
  address: string;
  txHash: string;
  at: string;
};

type MetricsResponse = {
  success: boolean;
  daily: DailyMetric[];
  totalDrips: number;
  totalWallets: number;
  rejections: Record<string, number>;
  recentDrips: DripLog[];
};

const PIE_COLORS = [
  'hsl(47, 96%, 57%)',
  'hsl(198, 80%, 50%)',
  'hsl(340, 75%, 55%)',
  'hsl(120, 60%, 45%)',
  'hsl(270, 60%, 55%)',
  'hsl(30, 80%, 55%)',
  'hsl(180, 60%, 45%)',
];

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 200, damping: 24 },
  },
};

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics', { cache: 'no-store' });
      const data = (await res.json()) as MetricsResponse;
      if (data.success) setMetrics(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void fetchMetrics();
    const id = setInterval(() => void fetchMetrics(), 60_000);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  const latestBalance = metrics?.daily
    .slice()
    .reverse()
    .find((d) => d.balance !== null)?.balance;

  const rejectionData = metrics
    ? Object.entries(metrics.rejections)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : [];

  const chartData = metrics?.daily.map((d) => ({
    date: d.date.slice(5),
    drips: d.drips,
    wallets: d.wallets,
    balance: d.balance ? Math.round(Number(d.balance)) : null,
  })) ?? [];

  return (
    <>
      <div className="relative min-h-screen px-4 pb-8 pt-24 sm:px-6">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[12%] top-[8%] h-60 w-60 rounded-full bg-primary/20 blur-[100px]" />
          <div className="absolute bottom-[8%] right-[12%] h-72 w-72 rounded-full bg-sky-500/10 blur-[120px]" />
          <div className="grid-pattern absolute inset-0 opacity-40 dark:opacity-20" />
        </div>

        {/* Breadcrumb */}
        <div className="mx-auto mb-6 flex max-w-5xl items-center gap-1 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">YellowScout</Link>
          <ChevronRight size={14} />
          <span className="text-foreground">Dashboard</span>
        </div>

        <div className="mx-auto max-w-5xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Observability Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Live metrics from the {TOKEN_SYMBOL} faucet on Sepolia.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">Loading metrics...</div>
          ) : !metrics ? (
            <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
              Metrics are unavailable. Redis may not be configured.
            </div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="visible" className="space-y-6">
              {/* Hero stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard icon={Droplets} label="Total Drips" value={metrics.totalDrips.toLocaleString()} />
                <StatCard icon={Users} label="Unique Wallets" value={metrics.totalWallets.toLocaleString()} />
                <StatCard
                  icon={Wallet}
                  label="Contract Balance"
                  value={latestBalance ? `${Math.round(Number(latestBalance)).toLocaleString()}` : '--'}
                  suffix={TOKEN_SYMBOL}
                />
                <StatCard icon={Activity} label="Today's Drips" value={(metrics.daily.at(-1)?.drips ?? 0).toLocaleString()} />
              </div>

              {/* Drips over time */}
              <motion.div variants={item} className="glass rounded-2xl p-5 shadow-glass-light dark:shadow-glass">
                <h2 className="mb-4 text-sm font-semibold">Drips (Last 30 Days)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="drips" fill="hsl(47, 96%, 57%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Wallets + Balance side by side */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <motion.div variants={item} className="glass rounded-2xl p-5 shadow-glass-light dark:shadow-glass">
                  <h2 className="mb-4 text-sm font-semibold">Unique Wallets (Last 30 Days)</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="wallets" stroke="hsl(198, 80%, 50%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>

                <motion.div variants={item} className="glass rounded-2xl p-5 shadow-glass-light dark:shadow-glass">
                  <h2 className="mb-4 text-sm font-semibold">Contract Balance (Last 30 Days)</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData.filter((d) => d.balance !== null)}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="balance" stroke="hsl(120, 60%, 45%)" fill="hsl(120, 60%, 45% / 0.15)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>
              </div>

              {/* Rejections + Recent drips */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {rejectionData.length > 0 && (
                  <motion.div variants={item} className="glass rounded-2xl p-5 shadow-glass-light dark:shadow-glass">
                    <h2 className="mb-4 text-sm font-semibold">Rejections Today</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={rejectionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                          {rejectionData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {rejectionData.map((d, i) => (
                        <Badge key={d.name} variant="outline" className="text-xs" style={{ borderColor: PIE_COLORS[i % PIE_COLORS.length] }}>
                          {d.name}: {d.value}
                        </Badge>
                      ))}
                    </div>
                  </motion.div>
                )}

                <motion.div variants={item} className="glass rounded-2xl p-5 shadow-glass-light dark:shadow-glass">
                  <h2 className="mb-4 text-sm font-semibold">Recent Drips</h2>
                  {metrics.recentDrips.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No drips recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {metrics.recentDrips.map((drip, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-xs">
                          <span className="font-mono text-muted-foreground">
                            {drip.address.slice(0, 6)}...{drip.address.slice(-4)}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(drip.at).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}

function StatCard({ icon: Icon, label, value, suffix }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <motion.div variants={item} className="glass flex flex-col gap-2 rounded-2xl p-4 shadow-glass-light dark:shadow-glass">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={16} />
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-mono text-lg font-semibold">
        {value}
        {suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </motion.div>
  );
}

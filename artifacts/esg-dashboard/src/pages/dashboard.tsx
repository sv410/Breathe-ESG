import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertCircle, AlertTriangle, CheckCircle2, Clock, TrendingUp, XCircle } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading, isError } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
        <div className="space-y-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="font-medium text-foreground">Failed to load dashboard</p>
          <p className="text-sm text-muted-foreground mt-1">Check the API server is running</p>
        </div>
      </div>
    );
  }

  const totalCo2eTonnes = summary.totalCo2eKg / 1000;
  const reviewProgress = summary.totalRecords > 0 
    ? Math.round(((summary.approvedCount + summary.rejectedCount) / summary.totalRecords) * 100)
    : 0;

  const statCards = [
    { 
      title: "Total Records", 
      value: summary.totalRecords.toLocaleString(), 
      icon: Activity, 
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      sub: `${totalCo2eTonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e total`
    },
    { 
      title: "Pending Review", 
      value: summary.pendingCount.toLocaleString(), 
      icon: Clock, 
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      sub: `${reviewProgress}% reviewed`
    },
    { 
      title: "Approved", 
      value: summary.approvedCount.toLocaleString(), 
      icon: CheckCircle2, 
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      sub: "locked for audit"
    },
    { 
      title: "Rejected", 
      value: summary.rejectedCount.toLocaleString(), 
      icon: XCircle, 
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/40",
      sub: "excluded from audit"
    },
    { 
      title: "Suspicious", 
      value: summary.suspiciousCount.toLocaleString(), 
      icon: AlertTriangle, 
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/40",
      sub: "need attention"
    },
  ];

  const scopeColors: Record<string, { bar: string; label: string }> = {
    scope1: { bar: "bg-blue-500", label: "Scope 1 — Direct combustion" },
    scope2: { bar: "bg-violet-500", label: "Scope 2 — Purchased energy" },
    scope3: { bar: "bg-teal-500", label: "Scope 3 — Value chain" },
  };

  const maxScopeCo2e = Math.max(...summary.byScope.map(s => s.co2eKg), 1);

  const sourceColors: Record<string, string> = {
    sap: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
    utility: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
    travel: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  };

  const statusColors: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    processing: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  };

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Q1 2024 · Meridian Industrial Group · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-card border border-card-border rounded-xl p-4 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground leading-tight">{stat.title}</p>
              <div className={`${stat.bg} p-1.5 rounded-lg`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground text-sm">Emissions by Scope</h2>
              <p className="text-xs text-muted-foreground mt-0.5">GHG Protocol Scope 1, 2, and 3</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              <TrendingUp className="h-3 w-3" />
              <span className="font-mono font-semibold text-foreground">
                {totalCo2eTonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              tCO₂e total
            </div>
          </div>
          <div className="p-6 space-y-5">
            {summary.byScope.map((scope) => {
              const colors = scopeColors[scope.scope] ?? { bar: "bg-slate-400", label: scope.scope };
              const pct = (scope.co2eKg / maxScopeCo2e) * 100;
              const tonnes = scope.co2eKg / 1000;
              const totalPct = totalCo2eTonnes > 0 ? ((tonnes / totalCo2eTonnes) * 100).toFixed(1) : "0";
              return (
                <div key={scope.scope} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-2.5 w-2.5 rounded-sm ${colors.bar}`} />
                      <span className="font-medium text-foreground">{colors.label}</span>
                      <span className="text-muted-foreground text-xs">{scope.count} records</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-foreground">
                        {tonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })} t
                      </span>
                      <span className="text-muted-foreground text-xs ml-2">({totalPct}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {summary.bySource && summary.bySource.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">By Source</p>
                <div className="flex flex-wrap gap-2">
                  {summary.bySource.map((src) => (
                    <div key={src.sourceType} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${sourceColors[src.sourceType] ?? "bg-slate-100 text-slate-600"}`}>
                        {src.sourceType}
                      </span>
                      <span className="text-xs font-mono font-medium text-foreground">
                        {(src.co2eKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} t
                      </span>
                      <span className="text-xs text-muted-foreground">{src.count} rec</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground text-sm">Recent Batches</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest ingestion activity</p>
            </div>
            <Link href="/batches">
              <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {summary.recentBatches.map((batch) => (
              <div key={batch.id} className="px-5 py-3.5 hover:bg-muted/40 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-xs font-medium text-foreground truncate leading-relaxed" title={batch.filename}>
                    {batch.filename}
                  </p>
                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusColors[batch.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {batch.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${sourceColors[batch.sourceType] ?? "bg-slate-100 text-slate-600"}`}>
                    {batch.sourceType}
                  </span>
                  <span>{batch.rowCount} rows</span>
                  {batch.errorCount > 0 && (
                    <span className="text-red-500 font-medium">{batch.errorCount} errors</span>
                  )}
                </div>
              </div>
            ))}
            {summary.recentBatches.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No batches yet
              </div>
            )}
          </div>
          {summary.pendingCount > 0 && (
            <div className="px-5 py-3 border-t border-border bg-amber-50/60 dark:bg-amber-950/20">
              <Link href="/records">
                <div className="flex items-center gap-2 cursor-pointer group">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400 group-hover:underline">
                    {summary.pendingCount} records pending review
                  </span>
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

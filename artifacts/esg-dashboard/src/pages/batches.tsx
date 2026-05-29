import { useListBatches, useListClients } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Link } from "wouter";
import { ArrowRight, FileText, AlertCircle } from "lucide-react";

const sourceColors: Record<string, string> = {
  sap: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  utility: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  travel: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
};

const statusColors: Record<string, { badge: string; dot: string }> = {
  completed: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  processing: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    dot: "bg-amber-500 animate-pulse",
  },
  failed: {
    badge: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    dot: "bg-red-500",
  },
};

export default function Batches() {
  const { data: batches, isLoading } = useListBatches();
  const { data: clients } = useListClients();

  const getClientName = (id: number) => clients?.find(c => c.id === id)?.name || `Client ${id}`;

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ingestion Batches</h1>
          <p className="text-sm text-muted-foreground mt-0.5">History of all data uploads and processing results</p>
        </div>
        <Link href="/ingest">
          <div className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline cursor-pointer">
            Upload new batch <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </Link>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-16">ID</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">File</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Rows</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Errors</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : batches?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No batches yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Upload data from the Ingest page to get started</p>
                </TableCell>
              </TableRow>
            ) : (
              batches?.map((batch) => {
                const sc = statusColors[batch.status] ?? statusColors.failed;
                return (
                  <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs text-muted-foreground">{batch.id}</TableCell>
                    <TableCell className="font-medium text-sm">{getClientName(batch.clientId)}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${sourceColors[batch.sourceType] ?? "bg-slate-100 text-slate-600"}`}>
                        {batch.sourceType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-[220px]">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate" title={batch.filename}>{batch.filename}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${sc.dot}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${sc.badge}`}>
                          {batch.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{batch.rowCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {batch.errorCount > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-red-600 dark:text-red-400 font-semibold font-mono text-sm">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {batch.errorCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 font-mono text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground font-mono">
                      {format(new Date(batch.createdAt), 'dd MMM yyyy')}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

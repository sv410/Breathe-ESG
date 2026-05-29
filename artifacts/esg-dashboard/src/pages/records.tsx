import { useState } from "react";
import {
  useListRecords,
  useListClients,
  useReviewRecord,
  useGetRecordAuditLog,
  getGetRecordAuditLogQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Flag, AlertTriangle, ClipboardCheck, History } from "lucide-react";
import { format } from "date-fns";
import type { EmissionsRecord } from "@workspace/api-client-react";

const scopeColors: Record<string, string> = {
  scope1: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  scope2: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  scope3: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
};

const sourceColors: Record<string, string> = {
  sap: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  utility: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  travel: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
};

const statusBadge: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  flagged: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  pending: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
};

export default function Records() {
  const [clientId, setClientId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [selectedRecord, setSelectedRecord] = useState<EmissionsRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const queryClient = useQueryClient();
  const { data: clients } = useListClients();

  const params: Record<string, unknown> = {};
  if (clientId !== "all") params.clientId = Number(clientId);
  if (status !== "all") params.status = status;

  const { data: recordsData, isLoading } = useListRecords(params as any);
  const reviewMutation = useReviewRecord();

  const { data: auditLogs } = useGetRecordAuditLog(selectedRecord?.id ?? 0, {
    query: {
      enabled: !!selectedRecord?.id,
      queryKey: selectedRecord ? getGetRecordAuditLogQueryKey(selectedRecord.id) : ["empty"],
    },
  });

  const getClientName = (id: number) => clients?.find(c => c.id === id)?.name ?? `Client ${id}`;

  const handleReview = (reviewStatus: "approved" | "rejected" | "flagged") => {
    if (!selectedRecord) return;
    reviewMutation.mutate(
      { id: selectedRecord.id, data: { status: reviewStatus, reviewNotes, reviewedBy: "analyst@breathe.esg" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/records"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
          if (selectedRecord) queryClient.invalidateQueries({ queryKey: getGetRecordAuditLogQueryKey(selectedRecord.id) });
          setSelectedRecord(null);
          setReviewNotes("");
        },
      }
    );
  };

  const total = recordsData?.total ?? 0;

  return (
    <div className="p-8 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Records</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? "Loading…" : `${total.toLocaleString()} record${total !== 1 ? "s" : ""} matching filters`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[150px] text-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {["Date", "Client", "Scope", "Source", "Category", "Activity", "tCO₂e", "Status"].map(h => (
                <TableHead key={h} className={`text-xs font-semibold uppercase tracking-wide text-muted-foreground ${h === "tCO₂e" || h === "Activity" ? "text-right" : ""}`}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : recordsData?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <ClipboardCheck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No records found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Adjust the filters or ingest new data</p>
                </TableCell>
              </TableRow>
            ) : (
              recordsData?.data?.map((record) => (
                <TableRow
                  key={record.id}
                  className={`cursor-pointer hover:bg-muted/30 transition-colors ${record.isSuspicious ? "bg-red-50/40 dark:bg-red-950/10 hover:bg-red-50/60 dark:hover:bg-red-950/20" : ""}`}
                  onClick={() => { setSelectedRecord(record); setReviewNotes(record.reviewNotes ?? ""); }}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(record.activityDate), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{getClientName(record.clientId)}</TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${scopeColors[record.scope] ?? "bg-slate-100 text-slate-600"}`}>
                      {record.scope.replace("scope", "S")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${sourceColors[record.sourceType] ?? "bg-slate-100 text-slate-600"}`}>
                      {record.sourceType}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate" title={record.category}>
                    {record.category}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {record.activityAmount.toLocaleString()} {record.activityUnit}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-sm whitespace-nowrap">
                    {(record.normalizedCo2eKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadge[record.status] ?? statusBadge.pending}`}>
                        {record.status}
                      </span>
                      {record.isSuspicious && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto p-0">
          {selectedRecord && (
            <div className="flex flex-col h-full">
              <div className="px-6 pt-6 pb-5 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadge[selectedRecord.status] ?? statusBadge.pending}`}>
                    {selectedRecord.status}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${scopeColors[selectedRecord.scope] ?? ""}`}>
                    {selectedRecord.scope.replace("scope", "Scope ")}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${sourceColors[selectedRecord.sourceType] ?? ""}`}>
                    {selectedRecord.sourceType}
                  </span>
                </div>
                <SheetTitle className="text-lg font-bold capitalize">{selectedRecord.category}</SheetTitle>
                <SheetDescription className="text-xs mt-1">
                  Record #{selectedRecord.id} · Batch #{selectedRecord.batchId} · {getClientName(selectedRecord.clientId)}
                </SheetDescription>
              </div>

              {selectedRecord.isSuspicious && (
                <div className="mx-6 mt-4 flex gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3.5">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Auto-flagged suspicious</p>
                    <p className="text-xs text-red-700/70 dark:text-red-400/70 mt-0.5">{selectedRecord.suspiciousReason}</p>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                <Tabs defaultValue="details" className="h-full">
                  <TabsList className="w-full rounded-none border-b h-auto p-0 bg-transparent">
                    <TabsTrigger value="details" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-sm">
                      Details & Review
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-sm">
                      Audit Log {auditLogs && auditLogs.length > 0 && (
                        <span className="ml-1.5 bg-muted text-muted-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5">
                          {auditLogs.length}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="p-6 space-y-5 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Activity Date", value: format(new Date(selectedRecord.activityDate), "d MMMM yyyy") },
                        { label: "Location", value: selectedRecord.location || "—" },
                        { label: "Activity Amount", value: `${selectedRecord.activityAmount.toLocaleString()} ${selectedRecord.activityUnit}`, mono: true },
                        { label: "Emissions (tCO₂e)", value: (selectedRecord.normalizedCo2eKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 4 }), mono: true, bold: true },
                      ].map(({ label, value, mono, bold }) => (
                        <div key={label} className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                          <p className={`text-sm ${mono ? "font-mono" : ""} ${bold ? "font-bold text-base" : "font-medium"}`}>{value}</p>
                        </div>
                      ))}
                      {selectedRecord.description && (
                        <div className="col-span-2 space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Description</p>
                          <p className="text-sm text-foreground/80 leading-relaxed">{selectedRecord.description}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Raw Source Data</p>
                      <div className="bg-muted rounded-lg p-3.5 overflow-x-auto border border-border">
                        <pre className="text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                          {JSON.stringify(selectedRecord.rawData, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border">
                      <p className="text-sm font-semibold text-foreground">Analyst Review</p>
                      <Textarea
                        placeholder="Add notes for audit trail (optional)…"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className="min-h-[90px] resize-none text-sm"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs h-9 text-sm"
                          onClick={() => handleReview("approved")}
                          disabled={reviewMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1.5" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30 h-9 text-sm"
                          onClick={() => handleReview("flagged")}
                          disabled={reviewMutation.isPending}
                        >
                          <Flag className="h-4 w-4 mr-1.5" /> Flag
                        </Button>
                        <Button
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30 h-9 text-sm"
                          onClick={() => handleReview("rejected")}
                          disabled={reviewMutation.isPending}
                        >
                          <X className="h-4 w-4 mr-1.5" /> Reject
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="audit" className="p-6 mt-0">
                    {auditLogs && auditLogs.length > 0 ? (
                      <div className="space-y-3">
                        {auditLogs.map((log, i) => (
                          <div key={log.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                                <History className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              {i < auditLogs.length - 1 && (
                                <div className="flex-1 w-px bg-border mt-1.5" />
                              )}
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="bg-card border border-border rounded-lg p-3.5 shadow-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadge[log.action] ?? statusBadge.pending}`}>
                                    {log.action}
                                  </span>
                                  <time className="font-mono text-[10px] text-muted-foreground">
                                    {format(new Date(log.createdAt), "d MMM yyyy, HH:mm")}
                                  </time>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">by <span className="font-medium text-foreground">{log.actor}</span></p>
                                {log.afterState && (log.afterState as any).note && (
                                  <p className="text-xs text-foreground/70 mt-2 italic">"{(log.afterState as any).note}"</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No audit history yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Actions taken on this record will appear here</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

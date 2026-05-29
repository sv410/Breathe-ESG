import { useState } from "react";
import { useListClients, getListBatchesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UploadCloud, File, CheckCircle2, AlertCircle, ChevronRight, Building2, Zap, Plane } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const sourceInfo = {
  sap: {
    label: "SAP ERP",
    sublabel: "Fuel & Procurement",
    icon: Building2,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-200 dark:border-indigo-800",
    activeBorder: "border-indigo-500",
    accept: ".txt,.csv",
    description: "Tab/semicolon-delimited flat file exported from SAP MB51 or ME2M. Handles German column headers (MENGE, MEINS, WERKS, BUDAT, BUKRS) and date formats YYYYMMDD, DD.MM.YYYY, or ISO.",
    example: "SAP_FI_BSEG_2024Q1_FUEL.txt",
    scope: "Scope 1 — Direct combustion",
    factors: "DEFRA 2023: diesel 2.688 kg CO₂e/L, LPG 1.555, natural gas 2.034/m³",
  },
  utility: {
    label: "Utility Bills",
    sublabel: "Electricity",
    icon: Zap,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-200 dark:border-teal-800",
    activeBorder: "border-teal-500",
    accept: ".csv",
    description: "Portal CSV export from National Grid, E.ON, SSE, or similar. Required columns: meter_id, period_start, period_end, consumption_kwh. Optional: location, tariff.",
    example: "national_grid_electricity_jan_feb_2024.csv",
    scope: "Scope 2 — Purchased electricity",
    factors: "DEFRA 2023: UK grid 0.207 kg CO₂e/kWh (location-based)",
  },
  travel: {
    label: "Corporate Travel",
    sublabel: "Flights, Hotels, Ground",
    icon: Plane,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800",
    activeBorder: "border-orange-500",
    accept: ".csv",
    description: "CSV export from Navan or Concur. Columns: trip_type (flight/hotel/ground_transport), origin, destination, distance_km, passengers, traveler, department, date.",
    example: "navan_export_2024Q1.csv",
    scope: "Scope 3 — Business travel",
    factors: "DEFRA 2023 + RFI: short-haul 0.255, long-haul 0.150 kg CO₂e/km/pax; hotel 31/night",
  },
} as const;

type SourceKey = keyof typeof sourceInfo;

export default function Ingest() {
  const { data: clients, isLoading: clientsLoading } = useListClients();
  const [clientId, setClientId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [activeSource, setActiveSource] = useState<SourceKey>("sap");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setLastResult(null);
    }
  };

  const handleUpload = async () => {
    if (!clientId || !file) {
      toast({ title: "Missing fields", description: "Please select a client and a file.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    setLastResult(null);
    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("file", file);

    try {
      const response = await fetch(`/api/ingest/${activeSource}`, { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Upload failed");
      }
      const result = await response.json();
      setLastResult({ ok: true, message: `Batch created — ${result.rowCount ?? "?"} rows processed, ${result.errorCount ?? 0} errors.` });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey() });
      toast({ title: "Upload successful", description: "Batch processing complete." });
    } catch (error: any) {
      setLastResult({ ok: false, message: error.message || "Upload failed" });
      toast({ title: "Upload error", description: error.message || "There was a problem uploading your file.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const info = sourceInfo[activeSource];
  const IconComponent = info.icon;
  const canSubmit = !!file && !!clientId && !isUploading;

  return (
    <div className="p-8 max-w-[900px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Ingestion</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload raw emissions data for normalization and analyst review</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(sourceInfo) as [SourceKey, typeof sourceInfo[SourceKey]][]).map(([key, src]) => {
          const SrcIcon = src.icon;
          const isActive = activeSource === key;
          return (
            <button
              key={key}
              onClick={() => { setActiveSource(key); setFile(null); setLastResult(null); }}
              className={`text-left p-4 rounded-xl border-2 transition-all bg-card shadow-xs hover:shadow-sm ${
                isActive ? `${src.activeBorder} shadow-sm` : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <div className={`inline-flex p-2 rounded-lg ${src.bg} mb-3`}>
                <SrcIcon className={`h-4 w-4 ${src.color}`} />
              </div>
              <div className="font-semibold text-sm text-foreground">{src.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{src.sublabel}</div>
              {isActive && (
                <div className={`mt-2 h-0.5 rounded-full ${src.bg.replace("bg-", "bg-").replace("50", "400").replace("950/40", "500")}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        <div className={`px-6 py-4 border-b border-border ${info.bg}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-white/60 dark:bg-black/20`}>
              <IconComponent className={`h-5 w-5 ${info.color}`} />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground">{info.label} — {info.sublabel}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{info.scope}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-muted/50 rounded-lg p-4 text-xs space-y-2">
            <p className="text-foreground/80 leading-relaxed">{info.description}</p>
            <div className="flex items-center gap-4 pt-1">
              <div>
                <span className="text-muted-foreground">Example file: </span>
                <code className="font-mono text-[11px] text-foreground bg-background px-1.5 py-0.5 rounded border border-border">{info.example}</code>
              </div>
            </div>
            <p className="text-muted-foreground/70 italic">{info.factors}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Target Client</label>
            <Select value={clientId} onValueChange={setClientId} disabled={clientsLoading}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={clientsLoading ? "Loading clients…" : "Select a client…"} />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Data File</label>
            <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer relative ${
              file ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30"
            }`}>
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
                accept={info.accept}
              />
              <div className="flex flex-col items-center gap-3">
                {file ? (
                  <>
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                      <File className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <UploadCloud className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Click to select or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{info.accept.split(",").join(" or ")} format</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {lastResult && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border text-sm ${
              lastResult.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
                : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
            }`}>
              {lastResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{lastResult.message}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleUpload}
              disabled={!canSubmit}
              className="gap-2 px-6"
            >
              {isUploading ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  Upload {info.label} data
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

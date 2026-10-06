"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  Link2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  uploadAndPreviewContactFileAction,
  importGoogleSheetPreviewAction,
  executeImportAction,
} from "@/lib/contacts/actions";
import { ColumnMapping, DeduplicationStrategy, ImportExecutionResult, ImportPreview } from "@/lib/contacts/types";

export function ImportWizardClient() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [sourceType, setSourceType] = useState<"file" | "sheets">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");

  const [importId, setImportId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ phone: "", name: "" });
  const [dedupStrategy, setDedupStrategy] = useState<DeduplicationStrategy>("SKIP");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportExecutionResult | null>(null);

  // Step 1 -> Step 2: Upload and Preview
  const handleUploadAndPreview = () => {
    setError(null);

    if (sourceType === "file" && !selectedFile) {
      setError("Please select a .csv or .xlsx file to upload.");
      return;
    }

    if (sourceType === "sheets" && !sheetUrl.trim()) {
      setError("Please enter a valid Google Sheets URL.");
      return;
    }

    startTransition(async () => {
      if (sourceType === "file" && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const res = await uploadAndPreviewContactFileAction(formData);

        if (!res.success || !res.preview || !res.importId) {
          setError(res.error || "Failed to parse file.");
        } else {
          setImportId(res.importId);
          setPreview(res.preview);
          setMapping(res.preview.suggestedMapping);
          setStep(2);
        }
      } else if (sourceType === "sheets") {
        const res = await importGoogleSheetPreviewAction(sheetUrl);
        if (!res.success || !res.preview || !res.importId) {
          setError(res.error || "Failed to access Google Sheet.");
        } else {
          setImportId(res.importId);
          setPreview(res.preview);
          setMapping(res.preview.suggestedMapping);
          setStep(2);
        }
      }
    });
  };

  // Step 2 -> Step 3: Validate mapping and proceed
  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    const isSupported = /\.(csv|xlsx|xls)$/i.test(file.name);
    if (!isSupported) {
      setError("Please drop a .csv, .xlsx, or .xls file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds the 10MB limit.");
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleMappingProceed = () => {
    if (!mapping.phone) {
      setError("You must select a column for Phone Number.");
      return;
    }
    if (!mapping.name) {
      setError("You must select a column for Full Name.");
      return;
    }
    setError(null);
    setStep(3);
  };

  // Step 3 -> Step 4: Execute Import
  const handleExecuteImport = () => {
    if (!importId) return;
    setError(null);

    startTransition(async () => {
      const res = await executeImportAction(importId, mapping, dedupStrategy);
      if (!res.success || !res.result) {
        setError(res.error || "Failed to execute contact import.");
      } else {
        setResult(res.result);
        setStep(4);
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            1
          </div>
          <span className={`text-xs font-medium ${step >= 1 ? "text-foreground" : "text-muted-foreground"}`}>
            Select File
          </span>
        </div>

        <div className="h-0.5 w-12 bg-muted" />

        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            2
          </div>
          <span className={`text-xs font-medium ${step >= 2 ? "text-foreground" : "text-muted-foreground"}`}>
            Map Columns
          </span>
        </div>

        <div className="h-0.5 w-12 bg-muted" />

        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            3
          </div>
          <span className={`text-xs font-medium ${step >= 3 ? "text-foreground" : "text-muted-foreground"}`}>
            Configure & Review
          </span>
        </div>

        <div className="h-0.5 w-12 bg-muted" />

        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 4 ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            4
          </div>
          <span className={`text-xs font-medium ${step === 4 ? "text-emerald-600" : "text-muted-foreground"}`}>
            Done
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Upload Source */}
      {step === 1 && (
        <div className="rounded-2xl border bg-card p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Step 1: Choose Import Source</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Upload an Excel (.xlsx), CSV, or connect a public Google Sheet.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSourceType("file")}
              className={`p-4 rounded-lg border text-left flex flex-col gap-2 transition-all ${
                sourceType === "file"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/30"
              }`}
            >
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-xs">Excel / CSV File</p>
                <p className="text-[11px] text-muted-foreground">Upload from your computer (.xlsx, .csv)</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSourceType("sheets")}
              className={`p-4 rounded-lg border text-left flex flex-col gap-2 transition-all ${
                sourceType === "sheets"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/30"
              }`}
            >
              <Link2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-xs">Google Sheets Link</p>
                <p className="text-[11px] text-muted-foreground">Import directly via public shared sheet link</p>
              </div>
            </button>
          </div>

          {sourceType === "file" ? (
            <div
              className="rounded-xl border-2 border-dashed bg-muted/10 p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleFileDrop}
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="text-xs font-medium">Drag and drop your contact spreadsheet here, or browse</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Supports .xlsx, .xls, .csv up to 10MB</p>
              </div>
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="text-xs mx-auto"
              />
              {selectedFile && (
                <p className="text-xs text-primary font-medium">Selected: {selectedFile.name}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="sheetUrl" className="text-xs">
                Google Sheets Public Link
              </Label>
              <Input
                id="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Ensure the sheet access is set to &ldquo;Anyone with the link can view&rdquo;.
              </p>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button onClick={handleUploadAndPreview} disabled={isPending} className="gap-1.5 h-9 text-xs">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue to Column Mapping
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Map Columns */}
      {step === 2 && preview && (
        <div className="rounded-2xl border bg-card p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Step 2: Map Spreadsheet Columns</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Match your spreadsheet headers with contact fields. We automatically suggested matches for you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Phone Number (+91) *</Label>
              <select
                value={mapping.phone}
                onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">-- Select Column --</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">Mandatory for automated AI calling.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Contact Full Name *</Label>
              <select
                value={mapping.name}
                onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">-- Select Column --</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">Used by the AI voice agent for greetings.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email Address (Optional)</Label>
              <select
                value={mapping.email || ""}
                onChange={(e) => setMapping({ ...mapping, email: e.target.value || undefined })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">-- None --</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">City / Location (Optional)</Label>
              <select
                value={mapping.city || ""}
                onChange={(e) => setMapping({ ...mapping, city: e.target.value || undefined })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">-- None --</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Tags / Categories (Optional)</Label>
              <select
                value={mapping.tags || ""}
                onChange={(e) => setMapping({ ...mapping, tags: e.target.value || undefined })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">-- None --</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sample Rows Preview */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-semibold text-muted-foreground">
              Preview First 3 Rows ({preview.totalEstimatedRows} total records detected)
            </h4>
            <div className="rounded border overflow-x-auto text-[11px]">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} className="p-2 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.slice(0, 3).map((row, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                      {preview.headers.map((h) => (
                        <td key={h} className="p-2 truncate max-w-[150px]">
                          {String(row[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setStep(1)} className="gap-1.5 text-xs">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button size="sm" onClick={handleMappingProceed} className="gap-1.5 text-xs">
              Configure Deduplication
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Deduplication & Review */}
      {step === 3 && (
        <div className="rounded-2xl border bg-card p-6 space-y-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Step 3: Review & Deduplication Rules</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Choose how to resolve duplicate phone numbers already present in your directory.
            </p>
          </div>

          <div className="space-y-3">
            <label
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                dedupStrategy === "SKIP"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/30"
              }`}
            >
              <input
                type="radio"
                name="dedup"
                checked={dedupStrategy === "SKIP"}
                onChange={() => setDedupStrategy("SKIP")}
                className="mt-0.5"
              />
              <div>
                <p className="text-xs font-semibold">Skip duplicates (Recommended)</p>
                <p className="text-[11px] text-muted-foreground">
                  If a phone number already exists, keep the existing contact and ignore the spreadsheet row.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                dedupStrategy === "OVERWRITE"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/30"
              }`}
            >
              <input
                type="radio"
                name="dedup"
                checked={dedupStrategy === "OVERWRITE"}
                onChange={() => setDedupStrategy("OVERWRITE")}
                className="mt-0.5"
              />
              <div>
                <p className="text-xs font-semibold">Update / Overwrite existing</p>
                <p className="text-[11px] text-muted-foreground">
                  If a phone number already exists, update its name, email, city, and tags from this import.
                </p>
              </div>
            </label>
          </div>

          <div className="rounded-md bg-muted/40 p-4 space-y-2 text-xs">
            <h4 className="font-semibold text-foreground">Compliance Protection Active</h4>
            <p className="text-muted-foreground text-[11px]">
              - Phone numbers in your business DNC list will be automatically flagged and kept inactive.
              <br />
              - Previously identified wrong-number contacts will be preserved and flagged.
            </p>
          </div>

          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-1.5 text-xs">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button size="sm" onClick={handleExecuteImport} disabled={isPending} className="gap-1.5 text-xs">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Start Contact Import
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Results */}
      {step === 4 && result && (
        <div className="rounded-2xl border bg-card p-6 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Import Complete!</h2>
              <p className="text-xs text-muted-foreground">
                Your contact list was successfully ingested, validated, and normalized.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground font-medium">Imported</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{result.importedCount}</p>
            </div>
            <div className="rounded border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground font-medium">Duplicates</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{result.duplicateCount}</p>
            </div>
            <div className="rounded border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground font-medium">DNC Filtered</p>
              <p className="text-xl font-bold text-destructive mt-0.5">{result.dncFilteredCount}</p>
            </div>
            <div className="rounded border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground font-medium">Invalid Numbers</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{result.invalidCount}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-destructive">
                Row Issues & Discarded Numbers ({result.errors.length})
              </h4>
              <div className="max-h-40 overflow-y-auto rounded border bg-muted/10 p-2 text-[11px] space-y-1">
                {result.errors.slice(0, 15).map((e, i) => (
                  <div key={i} className="text-muted-foreground">
                    Row {e.row}: {e.error} {e.phone && `(${e.phone})`}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" asChild className="text-xs">
              <Link href="/contacts/imports">View Import History</Link>
            </Button>
            <Button size="sm" asChild className="gap-1.5 text-xs">
              <Link href="/contacts">
                <Users className="h-4 w-4" />
                Go to Contacts Directory
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

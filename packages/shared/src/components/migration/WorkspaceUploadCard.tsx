import React, { useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  parseSpreadsheetContent,
  parseWorkbookBinary,
  type SpreadsheetParseResult,
} from "../../migration";

export interface WorkspaceUploadCardProps {
  onStartIngest: (params: {
    workspaceName: string;
    parseResult: SpreadsheetParseResult;
  }) => Promise<void>;
  isIngesting: boolean;
}

export function WorkspaceUploadCard({ onStartIngest, isIngesting }: WorkspaceUploadCardProps) {
  const currentYear = new Date().getFullYear();
  const [workspaceName, setWorkspaceName] = useState(`${currentYear}/${currentYear + 1} Baseline Intake`);
  const [parseResult, setParseResult] = useState<SpreadsheetParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setIsParsing(true);

    try {
      const lowerName = file.name.toLowerCase();
      let result: SpreadsheetParseResult;

      if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        result = parseWorkbookBinary(buffer);
      } else if (
        lowerName.endsWith(".csv") ||
        lowerName.endsWith(".tsv") ||
        lowerName.endsWith(".txt")
      ) {
        const text = await file.text();
        result = parseSpreadsheetContent(text);
      } else {
        throw new Error(
          "Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv, .tsv) file."
        );
      }

      if (result.totalRows === 0) {
        throw new Error("The uploaded spreadsheet contains no data rows.");
      }

      setParseResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse file";
      setParseError(msg);
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseResult || parseResult.totalRows === 0) return;

    await onStartIngest({
      workspaceName,
      parseResult,
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
          Upload & Stage School Spreadsheet
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Import student rosters and historical scores from CSV or Excel (.xlsx, .xls) files with zero direct database writes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Workspace Configurations */}
        <div className="max-w-md">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Workspace Label
            </label>
            <input
              type="text"
              required
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              placeholder="e.g. 2026/2027 Baseline Intake"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Missing admission IDs use the configured official policy after review. Historical IDs are preserved; this workspace has no private counter.
          </p>
        </div>

        {/* Dropzone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload spreadsheet dropzone. Click or press Enter to browse files."
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            parseError
              ? "border-rose-300 bg-rose-50/30"
              : fileName
              ? "border-indigo-300 bg-indigo-50/20"
              : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50/70"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              parseError ? "bg-rose-100 text-rose-600" : "bg-indigo-50 text-indigo-600"
            }`}>
              {isParsing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : parseError ? (
                <AlertCircle className="h-6 w-6" />
              ) : (
                <UploadCloud className="h-6 w-6" />
              )}
            </div>

            {parseError ? (
              <div>
                <p className="text-sm font-bold text-rose-800">{fileName || "Parsing error"}</p>
                <p className="text-xs font-medium text-rose-600 mt-1">{parseError}</p>
              </div>
            ) : fileName ? (
              <div>
                <p className="text-sm font-bold text-slate-900">{fileName}</p>
                {parseResult && (
                  <p className="text-xs font-medium text-emerald-600 mt-1 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Parsed {parseResult.totalRows} rows across {parseResult.headers.length} columns
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Click to browse or drag and drop your spreadsheet here
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supports Excel (.xlsx, .xls) and CSV (.csv, .tsv) files
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!parseResult || parseResult.totalRows === 0 || isIngesting || isParsing}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isIngesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Staging {parseResult?.totalRows} Records...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Begin Staging & Clash Intelligence</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

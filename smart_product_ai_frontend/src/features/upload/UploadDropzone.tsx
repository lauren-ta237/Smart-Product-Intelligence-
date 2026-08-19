// smart_product_ai_frontend/src/features/upload/UploadDropzone.tsx
import { useState, useRef } from "react";
import { uploadImage } from "../../api/images";
import { startAnalysis, getAnalysis, getDetectedProducts } from "../../api/analysis"; 
import AnalysisViewer from "../analysis/AnalysisViewer";

interface AnalysisData {
  image_url: string;
  products: any[];
}

export default function UploadDropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("idle");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileSelect = () => {
    if (!loading) fileInputRef.current?.click();
  };

  async function handleUpload() {
    if (!file) return;

    setLoading(true);
    setAnalysisData(null); 
    setStatusText("uploading");

    try {
      // 1. Upload and get permanent URL
      const image = await uploadImage(file);
      // Fallback to preview if upload response is malformed, but prioritize absolute path
      const permanentUrl = image?.url || preview || "";

      // 2. Trigger AI Analysis
      setStatusText("triggering");
      const triggerRes = await startAnalysis(image.id);
      const analysisId = triggerRes?.id || triggerRes?.analysis_id;
      
      if (!analysisId || analysisId === "undefined") {
        setStatusText("error");
        setLoading(false);
        return;
      }
      
      setStatusText("processing");

      // 3. Polling Logic
      const pollInterval = setInterval(async () => {
        try {
          const check = await getAnalysis(analysisId);
          const normalizedStatus = String(check.status).toUpperCase();
          
          if (normalizedStatus === "COMPLETED") {
            clearInterval(pollInterval);
            setStatusText("fetching_results");
            const productsList = await getDetectedProducts(analysisId);
            
            const payload: AnalysisData = {
              image_url: permanentUrl, 
              products: Array.isArray(productsList) ? productsList : (productsList.products || [])
            };

            setAnalysisData(payload);
            window.dispatchEvent(new CustomEvent("produceUploaded", { detail: payload }));
            setStatusText("success");
            setLoading(false);
          } else if (normalizedStatus === "FAILED") {
            clearInterval(pollInterval);
            setStatusText("failed");
            setLoading(false);
          }
        } catch (err: any) {
          if (err?.code !== "ECONNABORTED") {
            clearInterval(pollInterval);
            setStatusText("error");
            setLoading(false);
          }
        }
      }, 3000);

    } catch (error) {
      console.error("Upload pipeline failed:", error);
      setStatusText("error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10 antialiased">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl shadow-2xl">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Upload Store Image
          </h1>
          <p className="text-slate-400 text-sm mt-2">AI-powered retail product detection.</p>
        </header>
        
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) {
                setAnalysisData(null);
                setFile(null);
                setFile(selected);
                setPreview(URL.createObjectURL(selected));
                setStatusText("idle");
              }
            }}
          />

          <div 
            onClick={triggerFileSelect}
            className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer hover:bg-white/[0.02] transition-all border-white/10"
          >
            {file ? <p className="font-bold">{file.name}</p> : <p className="text-slate-400">Click to browse your device files</p>}
          </div>

          {preview && !analysisData && (
            <div className="flex justify-center bg-slate-950/40 p-4 rounded-2xl">
              <img src={preview} className="max-h-72 rounded-xl shadow-2xl" alt="Preview" />
            </div>
          )}

          <div className="flex items-center gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={handleUpload}
              disabled={loading || !file}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all disabled:opacity-30 cursor-pointer"
            >
              {loading ? "Processing..." : "Analyze Dataset"}
            </button>
            {loading && <span className="text-xs text-indigo-300 animate-pulse font-mono uppercase">{statusText}</span>}
          </div>
        </div>

        {analysisData && (
          <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl">
            <AnalysisViewer imageUrl={analysisData.image_url} products={analysisData.products} />
          </div>
        )}
      </div>
    </div>
  );
}
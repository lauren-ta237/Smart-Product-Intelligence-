import { api } from "./client";

/**
 * Starts AI processing after upload.
 * Backend: POST /api/v1/analysis/start/{image_id}
 */
export async function startAnalysis(imageId: string) {
  if (!imageId || imageId === "undefined") {
    console.error("[API Error] Cannot start analysis: imageId is missing or undefined.");
    throw new Error("Invalid Image ID provided.");
  }
  
  const res = await api.post(`/v1/analysis/start/${imageId}`);
  return res.data;
}

/**
 * Gets the current AI analysis status.
 * Backend: GET /api/v1/analysis/status/{analysis_id}  👈 🟢 FIXED URL PATH
 */
export async function getAnalysis(analysisId: string) {
  if (!analysisId || analysisId === "undefined") {
    console.error("[API Error] Cannot fetch analysis status: analysisId is missing or undefined.");
    throw new Error("Invalid Analysis ID provided.");
  }

  // 🟢 Remove '/status' so it hits /api/v1/analysis/{id} exactly as configured in your python module
  const response = await api.get(`/v1/analysis/${analysisId}`);
  return response.data;
}

/**
 * Gets products detected by AI.
 * Backend: GET /api/v1/analysis/{analysis_id}/products
 */
export async function getDetectedProducts(analysisId: string) {
  if (!analysisId || analysisId === "undefined") {
    console.error("[API Error] Cannot fetch products: analysisId is missing or undefined.");
    throw new Error("Invalid Analysis ID provided.");
  }

  const response = await api.get(`/v1/analysis/${analysisId}/products`);
  return response.data;
}
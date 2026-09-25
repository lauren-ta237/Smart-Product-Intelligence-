// apps/web/src/api/analysis.ts
import { api } from "./client";

/**
 * Starts AI processing after upload.
 * AI endpoints are exposed under the canonical /ai namespace.
 */
export async function startAnalysis(imageId: string) {
  if (!imageId || imageId === "undefined") {
    console.error("[API Error] Cannot start analysis: imageId is missing.");
    throw new Error("Invalid Image ID provided.");
  }
  
  const res = await api.post(`/ai/start/${imageId}`);
  return res.data;
}

/**
 * Gets the current AI analysis status.
 */
export async function getAnalysis(analysisId: string) {
  if (!analysisId || analysisId === "undefined") {
    console.error("[API Error] Cannot fetch analysis status: analysisId is missing.");
    throw new Error("Invalid Analysis ID provided.");
  }

  const response = await api.get(`/ai/${analysisId}`);
  return response.data;
}

/**
 * Gets products detected by AI.
 */
export async function getDetectedProducts(analysisId: string) {
  if (!analysisId || analysisId === "undefined") {
    console.error("[API Error] Cannot fetch products: analysisId is missing.");
    throw new Error("Invalid Analysis ID provided.");
  }

  const response = await api.get(`/ai/${analysisId}/products`);
  return response.data;
}
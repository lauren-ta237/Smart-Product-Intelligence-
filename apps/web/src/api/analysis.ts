// apps/web/src/api/analysis.ts
import { api } from "./client";

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
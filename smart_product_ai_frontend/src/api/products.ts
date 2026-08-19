// smart_product_ai_frontend/src/api/products.ts
import { api } from "./client";
import { type DetectedProduct, type Product, type ProductInput, type ProductFilters, type PaginatedProductsResponse } from "../types/products";

/**
 * Lists products using clean paginated parameters and search filters.
 */
export async function getProducts(
  filters?: ProductFilters
): Promise<PaginatedProductsResponse | Product[]> {
  const response = await api.get("/products", {
    params: filters,
  });
  return response.data;
}

/**
 * Retrieves standard product configuration by ID.
 */
export async function getProductById(id: string): Promise<Product> {
  const response = await api.get(`/products/${id}`);
  return response.data;
}

/**
 * Vendor manually inputs a newly mapped catalog item.
 */
export async function createProduct(data: ProductInput): Promise<Product> {
  const response = await api.post("/products", data);
  return response.data;
}

/**
 * Updates an existing catalog configuration.
 */
export async function updateProduct(
  id: string,
  data: Partial<ProductInput>
): Promise<Product> {
  const response = await api.patch(`/products/${id}`, data);
  return response.data;
}

/**
 * Permanently deletes a catalog item record.
 */
export async function deleteProduct(id: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/products/${id}`);
  return response.data;
}

/**
 * Approves a mapped catalog product and makes it public.
 */
export async function approveProduct(data: DetectedProduct): Promise<Product> {
  const response = await api.post("/products/approve", data);
  return response.data;
}

/**
 * Batch saves or updates multiple detected catalog products.
 */
export async function batchUpdateProducts(
  products: ProductInput[]
): Promise<Product[]> {
  const response = await api.post("/products/batch-update", products);
  return response.data;
}
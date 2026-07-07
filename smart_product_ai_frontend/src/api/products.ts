import { api } from "./client";
import { type DetectedProduct } from "../types/products";

/*
 Updates AI generated product information.
 Backend:
 PATCH /products/{id}
*/
export async function updateProduct(
  id: string,
  data: Partial<DetectedProduct>
) {
  const res = await api.patch(
    `/products/${id}`,
    data
  );
  
  return res.data;
}

/*
 Approves product.

 After approval it becomes
 a real marketplace product.
*/
export async function approveProduct(
  data: DetectedProduct
) {
  const res = await api.post(
    "/products/approve",
    data
  );

  return res.data;
}
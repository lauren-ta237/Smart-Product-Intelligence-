// smart_product_ai_frontend/src/api/images.ts
import { api } from "./client";

export async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);

  // 🟢 Fixed: Path simplified to "/media/upload"
  const response = await api.post(
    "/media/upload",
    form,
    {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    }
  );
  
  return response.data;
}
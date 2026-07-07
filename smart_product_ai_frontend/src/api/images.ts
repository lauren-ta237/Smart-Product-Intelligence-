import { api } from "./client";

export async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);

  const response = await api.post(
    "/v1/images/upload",
    form,
    {
      // 🟢 Pass headers safely, letting Axios append to interceptor variables
      headers: {
        "Content-Type": "multipart/form-data"
      }
    }
  );
  
  return response.data;
}
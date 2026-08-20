import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from "../api/products";
import type { ProductInput } from "../types/products";

export function useProducts(filters?: {
  category?: string;
  brand?: string;
  approved?: boolean;
  q?: string;
  page?: number;
  size?: number;
}) {
  const queryClient = useQueryClient();

  // Queries paginated array matching filter keys
  const productsQuery = useQuery({
    queryKey: ["products", filters],
    queryFn: () => getProducts(filters),
    placeholderData: (previousData) => previousData
  });

  const createMutation = useMutation({
    mutationFn: (newProduct: ProductInput) => createProduct(newProduct),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductInput> }) => updateProduct(id, data),
    onSuccess: (updatedProduct) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.setQueryData(["product", updatedProduct.id], updatedProduct);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  return {
    products: productsQuery.data ?? [],
    isLoading: productsQuery.isLoading,
    isError: productsQuery.isError,
    error: productsQuery.error,
    refetch: productsQuery.refetch,
    
    createProduct: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    
    updateProduct: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    
    deleteProduct: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending
  };
}

export function useProductDetail(id: string) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => getProductById(id),
    enabled: !!id
  });
}
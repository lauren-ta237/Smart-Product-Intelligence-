/*
    Shared frontend model.
    Aligned with the backend database schema.
*/

export type ProductCoordinates = number[] | number[][];
export type ProductBoundingBox = ProductCoordinates | Record<string, number>;

export interface Product {
    id: string;
    vendor_id: string | null;
    name: string;
    description: string | null;
    category: string | null;
    brand: string | null;
    sku: string | null;
    sku_us: string | null;
    sku_cm: string | null;
    market_sku: string | null;
    image_url: string | null;
    image_id: string | null;
    bounding_box: ProductBoundingBox | null;
    approved: boolean;
    created_at: string;
    updated_at: string;
    price: number | null;
    stock_quantity: number | null;
    location: string | null;
    vendor_location: string | null;
}

export interface ProductInput {
    name: string;
    description?: string;
    category?: string;
    brand?: string;
    sku?: string;
    sku_us?: string;
    sku_cm?: string;
    market_sku?: string;
    image_url?: string;
    image_id?: string;
    bounding_box?: ProductBoundingBox;
    approved?: boolean;
    price?: number;
    stock_quantity?: number;
    location?: string;
}

export interface ProductFilters {
    category?: string;
    brand?: string;
    approved?: boolean;
    q?: string;
    page?: number;
    size?: number;
}

export interface PaginatedProductsResponse {
    items: Product[];
    total: number;
    page: number;
    size: number;
    pages: number;
}

export interface DetectedProduct {
    id: string;
    name: string;               // Aligned with database column 'name'
    description: string | null;
    category: string | null;
    brand: string | null;
    sku: string | null;         // Aligned with database column 'sku'
    confidence_score: number;
    bounding_box: ProductCoordinates; 
    image_url?: string | null;
    
    // REGIONAL OVERRIDES: Expected string | null from FastAPI
    sku_us: string | null;     // Aligned with database column 'sku_us'
    sku_cm: string | null;     // Aligned with database column 'sku_cm'
    market_sku: string | null; // Aligned with database column 'market_sku'

    // Dynamic properties used for layout tracking & localizing shelf positions
    location: string | null; 
    price: number;             // Added transactional price attribute
    stock_quantity: number;    // Added transactional inventory quantity
    vendor_location?: string;  // Dynamically formatted vendor city/country
}
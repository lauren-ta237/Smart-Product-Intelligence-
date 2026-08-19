/*
    Shared frontend model.
    Aligned with the backend database schema.
*/

export type ProductCoordinates = number[] | number[][];

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
/*
    Shared frontend model.
    Perfectly aligned to match your FastAPI database schema output.
*/

export type ProductCoordinates = number[] | number[][];

export interface DetectedProduct {
    id: string;
    name: string;               // 🟢 Aligned with database column 'name'
    description: string | null;
    category: string | null;
    brand: string | null;
    sku: string | null;         // 🟢 Aligned with database column 'sku'
    confidence_score: number;
    bounding_box: ProductCoordinates; 
    
    // ⚡ REGIONAL OVERRIDES: Explicitly typed to always expect string | null from FastAPI
    sku_us: string | null;     // 🟢 Aligned with database column 'sku_us'
    sku_cm: string | null;     // 🟢 Aligned with database column 'sku_cm'
    market_sku: string | null; // 🟢 Aligned with database column 'market_sku'

    // 🟢 Dynamic runtime property used for layout tracking & localizing shelf positions
    location: string | null; 
}
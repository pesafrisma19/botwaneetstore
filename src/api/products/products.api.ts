import { apiRequest, ApiResponse } from '../client';

export interface ApiProduct {
  productId: number;
  sku: string;
  name: string;
  brandId?: number | null;
  brand: string | null;
  brandSlug?: string | null;
  regionId?: number | null;
  region?: string | null;
  category: string | null;
  productCategory?: string | null;
  price: number;
  availability: string;
  level?: string | null;
}

export interface ProductQuery {
  brandId?: string | number;
  categoryId?: string | number;
  regionId?: string | number;
  search?: string;
}

export function fetchApiProducts(
  apiKey: string,
  query?: ProductQuery
): Promise<ApiResponse<ApiProduct[]>> {
  return apiRequest<ApiProduct[]>('/api/v1/products', {
    method: 'GET',
    apiKey,
    query: {
      brandId: query?.brandId,
      categoryId: query?.categoryId,
      regionId: query?.regionId,
      search: query?.search,
    },
  });
}

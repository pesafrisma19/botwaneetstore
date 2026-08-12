import { apiRequest, ApiResponse } from '../client';

export interface ApiProduct {
  productId: number;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  price: number;
  availability: string;
}

export interface ProductQuery {
  brandId?: string | number;
  categoryId?: string | number;
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
      search: query?.search,
    },
  });
}

// src/services/api/adminUserApi.ts
import { fetchApi } from './httpClient';

export type AdminUserSortField =
  | 'createdAt'
  | 'level'
  | 'xp'
  | 'streak'
  | 'displayName'
  | 'email'
  | 'publicAccountId';

export type SortDirection = 'asc' | 'desc';

export interface AdminUserItem {
  id: string; // Canonical GUID
  publicAccountId: number; // 6-digit public ID
  displayName: string | null;
  email: string | null;
  level: number;
  xp: number;
  streak: number;
  roles: string[];
  createdAt: string;
  lastActiveAt?: string | null;
  hasPassword: boolean;
  status: 'Active' | 'Locked' | string;
}

export interface AdminUserPageResponse {
  items: AdminUserItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface AdminUserQueryParams {
  search?: string;
  role?: string;
  sortBy?: AdminUserSortField;
  sortOrder?: SortDirection;
  page?: number;
  pageSize?: number;
}

export const adminUserApi = {
  /**
   * Truy vấn danh sách học viên quản trị có tìm kiếm, sắp xếp và phân trang từ server
   */
  async queryUsers(
    params: AdminUserQueryParams = {},
    signal?: AbortSignal
  ): Promise<AdminUserPageResponse> {
    const searchParams = new URLSearchParams();

    if (params.search?.trim()) {
      searchParams.set('search', params.search.trim());
    }
    if (params.role?.trim()) {
      searchParams.set('role', params.role.trim());
    }
    if (params.sortBy) {
      searchParams.set('sortBy', params.sortBy);
    }
    if (params.sortOrder) {
      searchParams.set('sortOrder', params.sortOrder);
    }
    if (params.page !== undefined && params.page > 0) {
      searchParams.set('page', params.page.toString());
    }
    if (params.pageSize !== undefined && params.pageSize > 0) {
      searchParams.set('pageSize', params.pageSize.toString());
    }

    const qs = searchParams.toString();
    const endpoint = `/admin/users${qs ? `?${qs}` : ''}`;

    return await fetchApi<AdminUserPageResponse>(endpoint, {
      method: 'GET',
      signal,
    });
  },
};

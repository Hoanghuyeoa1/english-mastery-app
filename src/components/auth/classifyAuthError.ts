import { ApiError } from '../../services/api/httpClient';

export type AuthRequestLifecycle =
  | 'idle'
  | 'validating'
  | 'submitting'
  | 'success'
  | 'validation_error'
  | 'authentication_error'
  | 'server_unavailable'
  | 'network_error';

export interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function classifyAuthError(err: unknown): {
  lifecycle: AuthRequestLifecycle;
  message: string;
  fieldErrors?: FieldErrors;
} {
  if (err instanceof ApiError) {
    if (err.category === 'AUTH' || err.status === 401 || err.code === 'UNAUTHORIZED') {
      return {
        lifecycle: 'authentication_error',
        message: 'Email hoặc mật khẩu không chính xác.',
      };
    }
    if (err.category === 'FORBIDDEN' || err.status === 403 || err.code === 'FORBIDDEN') {
      return {
        lifecycle: 'authentication_error',
        message: 'Tài khoản không có quyền truy cập.',
      };
    }
    if (err.category === 'CONFLICT' || err.status === 409 || err.code === 'CONFLICT') {
      return {
        lifecycle: 'validation_error',
        message: 'Email này đã được sử dụng để đăng ký tài khoản.',
        fieldErrors: { email: 'Email này đã được sử dụng để đăng ký tài khoản.' },
      };
    }
    if (err.category === 'VALIDATION' || err.status === 400 || err.code === 'VALIDATION_FAILED') {
      return {
        lifecycle: 'validation_error',
        message: err.message || err.details || 'Thông tin không hợp lệ.',
      };
    }
    if (err.code === 'CLIENT_CLOSED_REQUEST' || err.status === 499) {
      return {
        lifecycle: 'idle',
        message: '',
      };
    }
    if (err.category === 'NETWORK' || err.code === 'NETWORK_ERROR' || err.status === 0) {
      return {
        lifecycle: 'network_error',
        message: err.message || 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.',
      };
    }
    if (err.category === 'TIMEOUT' || err.code === 'TIMEOUT' || err.status === 408) {
      return {
        lifecycle: 'network_error',
        message: 'Yêu cầu quá thời gian phản hồi (Timeout). Vui lòng thử lại sau.',
      };
    }
    if (err.category === 'RATE_LIMIT' || err.status === 429 || err.code === 'RATE_LIMIT') {
      return {
        lifecycle: 'server_unavailable',
        message: 'Quá nhiều yêu cầu cùng lúc. Vui lòng thử lại sau giây lát.',
      };
    }
    if (err.category === 'DATABASE_ERROR' || err.status === 502 || err.status === 503 || err.status === 504) {
      return {
        lifecycle: 'server_unavailable',
        message: 'Cơ sở dữ liệu hoặc máy chủ tạm thời gián đoạn. Vui lòng thử lại sau.',
      };
    }
    if (err.status >= 500) {
      return {
        lifecycle: 'server_unavailable',
        message: err.message || 'Lỗi hệ thống máy chủ.',
      };
    }
  }

  // Handle normalized errors from service layer
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const raw = (err as { raw?: unknown }).raw;
    if (raw) {
      return classifyAuthError(raw);
    }
    const msg = String((err as { message: unknown }).message || '');
    if (msg.includes('đã được sử dụng')) {
      return {
        lifecycle: 'validation_error',
        message: msg,
        fieldErrors: { email: msg },
      };
    }
    if (msg.includes('không chính xác')) {
      return {
        lifecycle: 'authentication_error',
        message: msg,
      };
    }
    if (msg.toLowerCase().includes('mạng') || msg.toLowerCase().includes('kết nối')) {
      return {
        lifecycle: 'network_error',
        message: msg,
      };
    }
    if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('thời gian phản hồi')) {
      return {
        lifecycle: 'network_error',
        message: msg,
      };
    }
    if (msg.toLowerCase().includes('gián đoạn') || msg.toLowerCase().includes('máy chủ')) {
      return {
        lifecycle: 'server_unavailable',
        message: msg,
      };
    }
    return {
      lifecycle: 'authentication_error',
      message: msg,
    };
  }

  return {
    lifecycle: 'server_unavailable',
    message: typeof err === 'string' ? err : 'Đã xảy ra sự cố trong quá trình xác thực.',
  };
}

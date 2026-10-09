import React, { useState, useRef, useEffect, useId } from 'react';
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogleExchange,
  linkGoogleWithCredentials,
  type AppAuthUser,
} from '../../services/cloudSyncService';
import { authApi } from '../../services/api/authApi';
import { ApiError } from '../../services/api/httpClient';
import {
  classifyAuthError,
  type AuthRequestLifecycle,
  type FieldErrors,
} from './classifyAuthError';

export type { AuthRequestLifecycle, FieldErrors };

function GoogleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export interface AuthFormProps {
  /** Initial mode for the form */
  initialMode?: 'signin' | 'signup';
  /** Callback fired when login or registration succeeds */
  onSuccess?: (user: AppAuthUser) => void;
  /** Callback fired when switching mode between signin and signup */
  onModeChange?: (mode: 'signin' | 'signup') => void;
  /** Whether to render top segmented switch tabs ('Đăng nhập' / 'Tạo tài khoản') */
  showModeSwitchTabs?: boolean;
  /** Whether to render footer text switch link ('Chưa có tài khoản? Tạo tài khoản') */
  showModeSwitchFooter?: boolean;
  /** Whether to include and validate Confirm Password in signup mode */
  includeConfirmPassword?: boolean;
  /** Extra container CSS classes */
  className?: string;
}

export function AuthForm({
  initialMode = 'signin',
  onSuccess,
  onModeChange,
  showModeSwitchTabs = true,
  showModeSwitchFooter = true,
  includeConfirmPassword = false,
  className = '',
}: AuthFormProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [lifecycle, setLifecycle] = useState<AuthRequestLifecycle>('idle');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Google OAuth & Account Collision States
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [collisionPrompt, setCollisionPrompt] = useState<{ email: string } | null>(null);
  const [collisionPassword, setCollisionPassword] = useState('');
  const [showCollisionPassword, setShowCollisionPassword] = useState(false);
  const [isCollisionSubmitting, setIsCollisionSubmitting] = useState(false);
  const [collisionError, setCollisionError] = useState<string | null>(null);

  const baseId = useId();
  const displayNameId = `${baseId}-displayName`;
  const emailId = `${baseId}-email`;
  const passwordId = `${baseId}-password`;
  const confirmPasswordId = `${baseId}-confirmPassword`;
  const tabSigninId = `${baseId}-tab-signin`;
  const tabSignupId = `${baseId}-tab-signup`;
  const formPanelId = `${baseId}-auth-panel`;
  const generalAlertId = `${baseId}-general-alert`;
  const displayNameErrorId = `${baseId}-displayName-error`;
  const emailErrorId = `${baseId}-email-error`;
  const passwordErrorId = `${baseId}-password-error`;
  const confirmPasswordErrorId = `${baseId}-confirmPassword-error`;

  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check URL query parameters and message events for Google OAuth
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Process URL query parameters if returning from redirect
    const searchParams = new URLSearchParams(window.location.search);
    const exchangeCode = searchParams.get('oauth_exchange_code');
    const oauthError = searchParams.get('oauth_error');
    const oauthEmail = searchParams.get('email');
    const errorMsg = searchParams.get('message');

    if (exchangeCode) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);

      setIsGoogleLoading(true);
      setGeneralError(null);
      void signInWithGoogleExchange(exchangeCode).then(({ data, error }) => {
        if (!isMountedRef.current) return;
        setIsGoogleLoading(false);
        if (error) {
          setGeneralError(error.message || 'Mã trao đổi Google không hợp lệ hoặc đã hết hạn.');
          return;
        }
        if (data?.user) {
          setLifecycle('success');
          setSuccessMessage('Đăng nhập với Google thành công!');
          onSuccess?.(data.user);
        }
      });
    } else if (oauthError) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);

      if (oauthError === 'email_collision' && oauthEmail) {
        setCollisionPrompt({ email: oauthEmail });
        setGeneralError('Email Google này đã tồn tại tài khoản mật khẩu. Vui lòng xác thực mật khẩu để liên kết.');
      } else if (oauthError === 'access_denied' || oauthError === 'cancelled') {
        setGeneralError('Bạn đã hủy yêu cầu đăng nhập bằng Google.');
      } else {
        setGeneralError(errorMsg || 'Đăng nhập Google không thành công. Vui lòng thử lại.');
      }
    }

    // 2. Listen to postMessage from popup OAuth window
    const handleOAuthMessage = (event: MessageEvent) => {
      if (typeof window !== 'undefined' && event.origin !== window.location.origin) return;
      if (event.data?.type === 'GOOGLE_AUTH_EXCHANGE' && event.data?.code) {
        setIsGoogleLoading(true);
        void signInWithGoogleExchange(event.data.code).then(({ data, error }) => {
          if (!isMountedRef.current) return;
          setIsGoogleLoading(false);
          if (error) {
            setGeneralError(error.message || 'Mã trao đổi Google không hợp lệ.');
          } else if (data?.user) {
            setLifecycle('success');
            setSuccessMessage('Đăng nhập với Google thành công!');
            onSuccess?.(data.user);
          }
        });
      } else if (event.data?.type === 'GOOGLE_AUTH_COLLISION' && event.data?.email) {
        setCollisionPrompt({ email: event.data.email });
        setGeneralError('Email Google này đã tồn tại tài khoản mật khẩu. Vui lòng xác thực mật khẩu để liên kết.');
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        setGeneralError(event.data.message || 'Đăng nhập Google không thành công.');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, [onSuccess]);

  const handleSwitchMode = (newMode: 'signin' | 'signup') => {
    if (authMode === newMode || isSubmittingRef.current || lifecycle === 'submitting') return;
    setAuthMode(newMode);
    setFieldErrors({});
    setGeneralError(null);
    setSuccessMessage(null);
    setLifecycle('idle');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setCollisionPrompt(null);
    setCollisionPassword('');
    setCollisionError(null);
    onModeChange?.(newMode);
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || isSubmittingRef.current || isCollisionSubmitting) return;
    setIsGoogleLoading(true);
    setGeneralError(null);
    setSuccessMessage(null);

    try {
      const returnUrl = typeof window !== 'undefined' ? window.location.href : undefined;
      const { authorizationUrl } = await authApi.getGoogleAuthUrl(returnUrl);

      if (!authorizationUrl) {
        throw new Error('Không nhận được địa chỉ xác thực từ máy chủ.');
      }

      // Try popup first
      const width = 500;
      const height = 650;
      const left = typeof window !== 'undefined' ? window.screenX + (window.outerWidth - width) / 2 : 100;
      const top = typeof window !== 'undefined' ? window.screenY + (window.outerHeight - height) / 2 : 100;

      let popup: Window | null = null;
      try {
        popup = window.open(
          authorizationUrl,
          'google_oauth_popup',
          `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,menubar=0`
        );
      } catch {
        popup = null;
      }

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Fallback to full page redirect if popup was blocked
        console.log('[Google Auth] Popup blocked or not supported. Falling back to redirect.');
        window.location.assign(authorizationUrl);
        return;
      }

      // Detect manual popup closure
      const pollTimer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(pollTimer);
          if (isMountedRef.current && isGoogleLoading) {
            setIsGoogleLoading(false);
            setGeneralError((prev) => prev || 'Bạn đã đóng cửa sổ đăng nhập Google.');
          }
        }
      }, 600);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setIsGoogleLoading(false);
      if (err instanceof ApiError) {
        if (err.category === 'NETWORK' || err.code === 'NETWORK_ERROR') {
          setGeneralError('Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra mạng.');
        } else {
          setGeneralError(err.message || 'Lỗi khởi tạo đăng nhập Google.');
        }
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Không thể khởi tạo đăng nhập Google. Vui lòng thử lại sau.');
      }
    }
  };

  const handleConfirmCollisionLink = async () => {
    if (!collisionPrompt?.email) return;
    if (!collisionPassword) {
      setCollisionError('Vui lòng nhập mật khẩu tài khoản hiện tại.');
      return;
    }

    setIsCollisionSubmitting(true);
    setCollisionError(null);

    try {
      const { data, error } = await linkGoogleWithCredentials(
        collisionPrompt.email,
        collisionPassword
      );

      if (!isMountedRef.current) return;
      if (error) {
        setCollisionError(error.message || 'Mật khẩu không chính xác hoặc không thể liên kết.');
        return;
      }

      if (data?.user) {
        setCollisionPrompt(null);
        setCollisionPassword('');
        setLifecycle('success');
        setSuccessMessage('Liên kết tài khoản Google và đăng nhập thành công!');
        onSuccess?.(data.user);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setCollisionError('Lỗi kết nối khi liên kết tài khoản.');
    } finally {
      if (isMountedRef.current) {
        setIsCollisionSubmitting(false);
      }
    }
  };

  const handleCancelCollision = () => {
    setCollisionPrompt(null);
    setCollisionPassword('');
    setCollisionError(null);
  };

  const validateForm = (): boolean => {
    const nextErrors: FieldErrors = {};
    const cleanEmail = email.trim();
    const cleanPassword = password;
    const cleanName = displayName.trim();
    const cleanConfirm = confirmPassword;

    // 1. Email validation
    if (!cleanEmail) {
      nextErrors.email = 'Vui lòng nhập địa chỉ email.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        nextErrors.email = 'Định dạng email không hợp lệ.';
      }
    }

    // 2. Password validation
    if (!cleanPassword) {
      nextErrors.password = 'Vui lòng nhập mật khẩu.';
    } else if (cleanPassword.length < 6) {
      nextErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
    }

    // 3. Signup specific validation
    if (authMode === 'signup') {
      if (!cleanName) {
        nextErrors.displayName = 'Vui lòng nhập tên hiển thị.';
      } else if (cleanName.length > 150) {
        nextErrors.displayName = 'Tên hiển thị không được vượt quá 150 ký tự.';
      }

      if (cleanPassword && !/\d/.test(cleanPassword)) {
        nextErrors.password = 'Mật khẩu phải chứa ít nhất một chữ số (0-9).';
      }

      if (includeConfirmPassword) {
        if (!cleanConfirm) {
          nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
        } else if (cleanPassword !== cleanConfirm) {
          nextErrors.confirmPassword = 'Mật khẩu xác nhận không trùng khớp.';
        }
      }
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setLifecycle('validation_error');
      // Pick first field error message for general feedback if needed
      const firstErrorMessage =
        nextErrors.email ||
        nextErrors.password ||
        nextErrors.displayName ||
        nextErrors.confirmPassword;
      setGeneralError(firstErrorMessage || 'Vui lòng kiểm tra lại thông tin.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lifecycle === 'submitting' || isSubmittingRef.current) return;

    setGeneralError(null);
    setSuccessMessage(null);
    setLifecycle('validating');

    const isValid = validateForm();
    if (!isValid) return;

    isSubmittingRef.current = true;
    setLifecycle('submitting');

    const cleanEmail = email.trim();
    const cleanPassword = password;
    const cleanName = displayName.trim();

    try {
      if (authMode === 'signin') {
        const { data, error } = await signInWithEmail(cleanEmail, cleanPassword);
        if (!isMountedRef.current) return;
        if (error) {
          const classified = classifyAuthError(error);
          setLifecycle(classified.lifecycle);
          setGeneralError(classified.message);
          if (classified.fieldErrors) {
            setFieldErrors(classified.fieldErrors);
          }
          return;
        }

        if (data?.user) {
          setLifecycle('success');
          setSuccessMessage('Đăng nhập thành công!');
          onSuccess?.(data.user);
        }
      } else {
        const { data, error } = await signUpWithEmail(cleanEmail, cleanPassword, cleanName);
        if (!isMountedRef.current) return;
        if (error) {
          const classified = classifyAuthError(error);
          setLifecycle(classified.lifecycle);
          setGeneralError(classified.message);
          if (classified.fieldErrors) {
            setFieldErrors(classified.fieldErrors);
          }
          return;
        }

        if (data?.user) {
          setLifecycle('success');
          setSuccessMessage('Đăng ký tài khoản thành công! Bạn đã có thể bắt đầu học.');
          onSuccess?.(data.user);
        }
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const classified = classifyAuthError(err);
      setLifecycle(classified.lifecycle);
      setGeneralError(classified.message);
      if (classified.fieldErrors) {
        setFieldErrors(classified.fieldErrors);
      }
    } finally {
      if (isMountedRef.current) {
        isSubmittingRef.current = false;
      }
    }
  };

  const isSubmitting = lifecycle === 'submitting' || isGoogleLoading || isCollisionSubmitting;
  // Avoid duplicating text between top alert and bottom field error
  const hasMatchingFieldError =
    generalError && Object.values(fieldErrors).some((val) => val === generalError);
  const showAlertBanner = Boolean((generalError && !hasMatchingFieldError) || successMessage);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Segmented Mode Switch Tabs */}
      {showModeSwitchTabs && (
        <div
          role="tablist"
          aria-label="Phương thức đăng nhập hoặc tạo tài khoản"
          className="flex p-1 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs font-bold"
        >
          <button
            type="button"
            role="tab"
            id={tabSigninId}
            aria-selected={authMode === 'signin'}
            aria-controls={formPanelId}
            data-testid="tab-signin"
            onClick={() => handleSwitchMode('signin')}
            className={`flex-1 py-2.5 min-h-[44px] rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              authMode === 'signin'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            role="tab"
            id={tabSignupId}
            aria-selected={authMode === 'signup'}
            aria-controls={formPanelId}
            data-testid="tab-signup"
            onClick={() => handleSwitchMode('signup')}
            className={`flex-1 py-2.5 min-h-[44px] rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              authMode === 'signup'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tạo tài khoản
          </button>
        </div>
      )}

      {/* General Alert Feedback */}
      {showAlertBanner && (
        <div
          id={generalAlertId}
          role="alert"
          aria-live="assertive"
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 border ${
            successMessage
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          {successMessage ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          )}
          <span>{successMessage || generalError}</span>
        </div>
      )}

      {/* Google OAuth Continue Button */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting || isGoogleLoading || isCollisionSubmitting}
          data-testid="google-signin-btn"
          aria-label="Tiếp tục với Google"
          className="w-full min-h-[46px] py-2.5 px-4 bg-slate-900 hover:bg-slate-850 active:bg-slate-800 text-slate-100 font-bold rounded-2xl border border-slate-700/80 hover:border-slate-600 transition-all flex items-center justify-center gap-2.5 text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {isGoogleLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Đang kết nối Google...</span>
            </>
          ) : (
            <>
              <GoogleIcon className="w-4 h-4 shrink-0" />
              <span>Tiếp tục với Google</span>
            </>
          )}
        </button>

        {/* Account Collision Secure Linking Banner */}
        {collisionPrompt && (
          <div
            data-testid="collision-linking-card"
            className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3 animate-in fade-in duration-200"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-300">Yêu cầu xác nhận liên kết tài khoản</h4>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Email Google <strong>{collisionPrompt.email}</strong> đã được đăng ký bằng mật khẩu. Nhập mật khẩu tài khoản hiện tại để hoàn tất liên kết và đăng nhập an toàn.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type={showCollisionPassword ? 'text' : 'password'}
                  value={collisionPassword}
                  onChange={(e) => {
                    setCollisionPassword(e.target.value);
                    if (collisionError) setCollisionError(null);
                  }}
                  placeholder="Nhập mật khẩu tài khoản hiện tại..."
                  disabled={isCollisionSubmitting}
                  className="w-full min-h-[40px] pl-9 pr-10 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 text-white placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCollisionPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  {showCollisionPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {collisionError && (
                <p className="text-xs text-rose-400 font-medium pl-1">{collisionError}</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmCollisionLink}
                  disabled={isCollisionSubmitting}
                  className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-60"
                >
                  {isCollisionSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Xác nhận liên kết & Đăng nhập</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelCollision}
                  disabled={isCollisionSubmitting}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase">
            Hoặc sử dụng email
          </span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>
      </div>

      {/* Main Authentication Form */}
      <form
        id={formPanelId}
        role="tabpanel"
        aria-labelledby={authMode === 'signin' ? tabSigninId : tabSignupId}
        onSubmit={handleSubmit}
        noValidate
        className="space-y-3.5"
      >
        {/* Display Name Input (Signup Mode Only) */}
        {authMode === 'signup' && (
          <div>
            <label
              htmlFor={displayNameId}
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Tên hiển thị
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id={displayNameId}
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (fieldErrors.displayName) {
                    setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
                  }
                }}
                placeholder="Ví dụ: Hoàng Anh"
                aria-invalid={Boolean(fieldErrors.displayName)}
                aria-describedby={fieldErrors.displayName ? displayNameErrorId : undefined}
                className={`w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-slate-950/70 border rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors ${
                  fieldErrors.displayName
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
                disabled={isSubmitting}
                required
              />
            </div>
            {fieldErrors.displayName && (
              <p
                id={displayNameErrorId}
                role="alert"
                className="text-xs text-rose-400 mt-1 font-medium"
              >
                {fieldErrors.displayName}
              </p>
            )}
          </div>
        )}

        {/* Email Input */}
        <div>
          <label htmlFor={emailId} className="block text-xs font-semibold text-slate-300 mb-1">
            Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="name@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? emailErrorId : undefined}
              className={`w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-slate-950/70 border rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors ${
                fieldErrors.email
                  ? 'border-rose-500 focus:border-rose-400'
                  : 'border-slate-800 focus:border-emerald-500'
              }`}
              disabled={isSubmitting}
              required
            />
          </div>
          {fieldErrors.email && (
            <p id={emailErrorId} role="alert" className="text-xs text-rose-400 mt-1 font-medium">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password Input */}
        <div>
          <label htmlFor={passwordId} className="block text-xs font-semibold text-slate-300 mb-1">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              placeholder="••••••••"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password
                  ? passwordErrorId
                  : authMode === 'signup'
                  ? `${passwordId}-hint`
                  : undefined
              }
              className={`w-full min-h-[44px] pl-10 pr-12 py-2.5 bg-slate-950/70 border rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors ${
                fieldErrors.password
                  ? 'border-rose-500 focus:border-rose-400'
                  : 'border-slate-800 focus:border-emerald-500'
              }`}
              disabled={isSubmitting}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              data-testid="toggle-password-visibility"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p id={passwordErrorId} role="alert" className="text-xs text-rose-400 mt-1 font-medium">
              {fieldErrors.password}
            </p>
          )}
          {authMode === 'signup' && !fieldErrors.password && (
            <p id={`${passwordId}-hint`} className="text-[11px] text-slate-400 mt-1 pl-1">
              Mật khẩu tối thiểu 6 ký tự, gồm ít nhất 1 chữ số (0-9).
            </p>
          )}
        </div>

        {/* Confirm Password Input (Signup Mode when enabled) */}
        {authMode === 'signup' && includeConfirmPassword && (
          <div>
            <label
              htmlFor={confirmPasswordId}
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id={confirmPasswordId}
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                }}
                placeholder="Nhập lại mật khẩu"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? confirmPasswordErrorId : undefined}
                className={`w-full min-h-[44px] pl-10 pr-12 py-2.5 bg-slate-950/70 border rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors ${
                  fieldErrors.confirmPassword
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                aria-pressed={showConfirmPassword}
                data-testid="toggle-confirm-password-visibility"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p
                id={confirmPasswordErrorId}
                role="alert"
                className="text-xs text-rose-400 mt-1 font-medium"
              >
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>
        )}

        {/* Submit Button with Loading State & Submit Lock */}
        <button
          type="submit"
          data-testid="auth-submit-btn"
          disabled={isSubmitting}
          className="w-full min-h-[48px] py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold rounded-2xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {isSubmitting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 fill-slate-950" />
          )}
          <span>{authMode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}</span>
        </button>
      </form>

      {/* Footer Mode Switcher Link */}
      {showModeSwitchFooter && (
        <div className="text-center text-xs text-slate-400 pt-2">
          {authMode === 'signin' ? (
            <span>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('signup')}
                className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
              >
                Tạo tài khoản mới
              </button>
            </span>
          ) : (
            <span>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('signin')}
                className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
              >
                Đăng nhập ngay
              </button>
            </span>
          )}
        </div>
      )}

      {/* Local-First Reassurance Note */}
      <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-2xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-slate-400 leading-relaxed">
          <strong>Local-First:</strong> Bạn có thể học bình thường không cần đăng nhập. Khi đăng nhập, thành tích học tập sẽ được tự động ghi nhận vào Bảng xếp hạng trực tuyến.
        </div>
      </div>
    </div>
  );
}

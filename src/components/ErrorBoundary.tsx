import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Trash2, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetStorage = () => {
    try {
      localStorage.removeItem('english_mastery_storage_v2');
      localStorage.removeItem('english_mastery_storage');
      sessionStorage.clear();
      window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            
            <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-500/10">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">Đã Xảy Ra Lỗi Khởi Động</h2>
              <p className="text-sm text-slate-400">
                Ứng dụng phát hiện sự cố gián đoạn trong quá trình xử lý giao diện hoặc dữ liệu bộ nhớ.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-left overflow-x-auto max-h-36 font-mono text-xs text-red-300">
                <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Tải Lại Ứng Dụng</span>
              </button>

              <button
                onClick={this.handleResetStorage}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-750 text-rose-400 border border-rose-500/30 font-bold rounded-2xl transition-all text-sm"
                title="Xóa bộ nhớ đệm LocalStorage bị tràn và khôi phục cài đặt gốc"
              >
                <Trash2 className="w-4 h-4" />
                <span>Khôi Phục Dữ Liệu Gốc</span>
              </button>
            </div>

            <div className="pt-2 text-[11px] text-slate-500">
              English Mastery Hub • Tự động bảo vệ và cách ly lỗi
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

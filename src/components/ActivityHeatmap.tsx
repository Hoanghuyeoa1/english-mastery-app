import React, { useMemo } from 'react';
import { Flame, Calendar, Sparkles, TrendingUp } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const ActivityHeatmap: React.FC = () => {
  const { dailyHistory, profile } = useAppStore();

  // Tạo danh sách 60 ngày gần nhất (9 tuần)
  const heatmapData = useMemo(() => {
    const days: Array<{
      date: string;
      dayOfWeek: number; // 0: CN, 1: T2, ..., 6: T7
      formattedDate: string;
      wordsCount: number;
      xpGained: number;
      level: number; // 0 to 4
    }> = [];

    const now = new Date();
    
    // Tạo 63 ngày (đúng 9 tuần x 7 ngày) để lưới vuông vức
    for (let i = 62; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const record = dailyHistory[dateStr];
      const wordsCount = record ? (record.wordsReviewed || 0) + (record.newWordsLearned || 0) : 0;
      const xpGained = record ? (record.xpGained || 0) : 0;

      // Xác định cấp độ màu xanh (0 - 4)
      let level = 0;
      if (wordsCount > 25) level = 4;
      else if (wordsCount >= 15) level = 3;
      else if (wordsCount >= 6) level = 2;
      else if (wordsCount >= 1) level = 1;

      // Format hiển thị: DD/MM/YYYY
      const formattedDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

      days.push({
        date: dateStr,
        dayOfWeek: d.getDay(),
        formattedDate,
        wordsCount,
        xpGained,
        level,
      });
    }

    return days;
  }, [dailyHistory]);

  // Chia thành các tuần (mỗi tuần 7 ngày)
  const weeks = useMemo(() => {
    const res: Array<typeof heatmapData> = [];
    for (let i = 0; i < heatmapData.length; i += 7) {
      res.push(heatmapData.slice(i, i + 7));
    }
    return res;
  }, [heatmapData]);

  // Thống kê tổng hợp trong 60 ngày
  const totalWordsInPeriod = useMemo(() => {
    return heatmapData.reduce((acc, curr) => acc + curr.wordsCount, 0);
  }, [heatmapData]);

  const activeDaysCount = useMemo(() => {
    return heatmapData.filter((d) => d.wordsCount > 0 || d.xpGained > 0).length;
  }, [heatmapData]);

  // Màu sắc tương ứng theo level
  const getCellColor = (level: number) => {
    switch (level) {
      case 4:
        return 'bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-400/40';
      case 3:
        return 'bg-emerald-500 border-emerald-400';
      case 2:
        return 'bg-emerald-700/90 border-emerald-600';
      case 1:
        return 'bg-emerald-950 border-emerald-800/80';
      default:
        return 'bg-slate-850/80 border-slate-800 hover:border-slate-700';
    }
  };

  const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
      
      {/* Header Heatmap */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <span>Biểu Đồ Nhiệt Học Tập (Activity Heatmap)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Theo dõi độ chăm chỉ trong 60 ngày gần nhất (tương tự GitHub / LeetCode Heatmap)
          </p>
        </div>

        {/* Quick Summary Stats */}
        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 bg-slate-800/80 border border-slate-750 rounded-xl">
            <span className="text-slate-400">Đã học: </span>
            <strong className="text-emerald-400">{totalWordsInPeriod} từ</strong>
          </div>

          <div className="px-3 py-1.5 bg-slate-800/80 border border-slate-750 rounded-xl">
            <span className="text-slate-400">Số ngày thắp lửa: </span>
            <strong className="text-orange-400">{activeDaysCount} ngày</strong>
          </div>
        </div>
      </div>

      {/* Heatmap Grid View */}
      <div className="overflow-x-auto no-scrollbar py-2">
        <div className="inline-flex flex-col gap-1.5 min-w-[500px]">
          
          {/* Grid rows for 7 days of week */}
          {dayLabels.map((label, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-1.5">
              {/* Day label */}
              <span className="w-6 text-[10px] font-bold text-slate-500 text-right pr-1 select-none">
                {dayIdx % 2 === 1 ? label : ''}
              </span>

              {/* Day cells for each week */}
              <div className="flex items-center gap-1.5">
                {weeks.map((week, weekIdx) => {
                  const day = week[dayIdx];
                  if (!day) {
                    return <div key={weekIdx} className="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-transparent" />;
                  }

                  const tooltipText = `${day.formattedDate}: ${day.wordsCount} từ đã ôn • +${day.xpGained} XP`;

                  return (
                    <div
                      key={weekIdx}
                      title={tooltipText}
                      className={`group relative w-4 h-4 sm:w-5 sm:h-5 rounded-md border transition-all duration-200 transform hover:scale-125 hover:z-20 cursor-pointer ${getCellColor(
                        day.level
                      )}`}
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                        <div className="bg-slate-950 border border-slate-700 text-white text-[11px] font-medium py-1 px-2.5 rounded-lg shadow-xl whitespace-nowrap">
                          <span className="font-bold text-emerald-400">{day.formattedDate}</span>
                          <span className="block text-[10px] text-slate-300">
                            {day.wordsCount > 0 ? `${day.wordsCount} từ vựng (+${day.xpGained} XP)` : 'Không có hoạt động'}
                          </span>
                        </div>
                        <div className="w-2 h-2 bg-slate-950 border-r border-b border-slate-700 rotate-45 -mt-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        </div>
      </div>

      {/* Heatmap Legend (Mức độ chăm chỉ) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400 fill-orange-400/30" />
          <span>Chuỗi ngày học liên tục hiện tại: <strong className="text-orange-400 font-bold">{profile.streak} ngày</strong></span>
        </div>

        {/* Level Indicator */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-500">Ít</span>
          <div className="w-3.5 h-3.5 rounded bg-slate-850 border border-slate-800" title="0 từ" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-950 border border-emerald-800/80" title="1 - 5 từ" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-700/90 border border-emerald-600" title="6 - 15 từ" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-400" title="16 - 25 từ" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-400 border border-emerald-300 shadow-sm shadow-emerald-400/40" title="> 25 từ" />
          <span className="text-slate-500">Nhiều</span>
        </div>
      </div>

    </div>
  );
};

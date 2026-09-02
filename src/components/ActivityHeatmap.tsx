import React, { useState, useMemo } from 'react';
import { Flame, Calendar } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

type TimeRange = 13 | 24 | 52; // 3 tháng (~13 tuần), 6 tháng (~24 tuần), 1 năm (~52 tuần)

interface HeatmapDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0: Mon, 1: Tue, ..., 6: Sun
  formattedDate: string; // DD/MM/YYYY
  wordsCount: number;
  xpGained: number;
  level: number; // 0 to 4
  isToday: boolean;
  isFuture: boolean;
}

export const ActivityHeatmap: React.FC = () => {
  const { dailyHistory, profile } = useAppStore();

  const [timeRange, setTimeRange] = useState<TimeRange>(24); // Mặc định: 6 Tháng (24 tuần)
  const [hoveredDay, setHoveredDay] = useState<{
    day: HeatmapDay;
    x: number;
    y: number;
  } | null>(null);
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null);

  // Tính toán dữ liệu 24 tuần (Thứ Hai -> Chủ Nhật) kết thúc đúng tại tuần hiện tại
  const { weeks, monthLabelsByWeek, totalWordsInPeriod, activeDaysCount, totalXpInPeriod } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Căn chỉnh tuần hiện tại kết thúc vào Chủ Nhật (Sunday)
    const jsDay = now.getDay(); // 0: CN, 1: T2, ..., 6: T7
    const dayOfWeekMon = jsDay === 0 ? 6 : jsDay - 1; // 0: T2 ... 6: CN
    const daysToSunday = 6 - dayOfWeekMon;

    const endSunday = new Date(now);
    endSunday.setDate(now.getDate() + daysToSunday);

    // Tính ngày Thứ Hai đầu tiên của chuỗi tuần
    const totalDays = timeRange * 7;
    const startDate = new Date(endSunday);
    startDate.setDate(endSunday.getDate() - totalDays + 1);

    const allWeeks: HeatmapDay[][] = [];
    let totalWords = 0;
    let activeDays = 0;
    let totalXp = 0;

    for (let w = 0; w < timeRange; w++) {
      const weekDays: HeatmapDay[] = [];

      for (let d = 0; d < 7; d++) {
        const curDate = new Date(startDate);
        curDate.setDate(startDate.getDate() + w * 7 + d);

        const dateStr = curDate.toISOString().split('T')[0];
        const isFuture = dateStr > todayStr;
        const isToday = dateStr === todayStr;

        const record = dailyHistory[dateStr];

        // VỆ TINH BẢO VỆ: Nếu dính lỗi cũ (> 100 từ), reset về 0 (không tạo số liệu ảo)
        let safeWordsCount = 0;
        let safeXp = 0;

        if (!isFuture && record) {
          const rawReviewed = record.wordsReviewed || 0;
          const rawNew = record.newWordsLearned || 0;
          const cleanReviewed = rawReviewed > 100 ? 0 : Math.max(0, rawReviewed);
          const cleanNew = rawNew > 100 ? 0 : Math.max(0, rawNew);
          safeWordsCount = cleanReviewed + cleanNew;
          safeXp = Math.min(2000, Math.max(0, record.xpGained || 0));
        }

        if (!isFuture && (safeWordsCount > 0 || safeXp > 0)) {
          totalWords += safeWordsCount;
          totalXp += safeXp;
          activeDays += 1;
        }

        // Cấp độ nhiệt (0 đến 4)
        let level = 0;
        if (!isFuture) {
          if (safeWordsCount > 20) level = 4;
          else if (safeWordsCount >= 12) level = 3;
          else if (safeWordsCount >= 6) level = 2;
          else if (safeWordsCount >= 1 || safeXp > 0) level = 1;
        }

        const formattedDate = `${curDate.getDate().toString().padStart(2, '0')}/${(curDate.getMonth() + 1)
          .toString()
          .padStart(2, '0')}/${curDate.getFullYear()}`;

        weekDays.push({
          date: dateStr,
          dayOfWeek: d,
          formattedDate,
          wordsCount: safeWordsCount,
          xpGained: safeXp,
          level,
          isToday,
          isFuture,
        });
      }

      allWeeks.push(weekDays);
    }

    // Xác định nhãn tháng cho từng cột tuần (bao phủ đầy đủ từ đầu kỳ đến cuối kỳ)
    const monthLabelsMap: Record<number, string> = {};
    let lastMonth = -1;
    let lastLabeledWeek = -10;

    for (let w = 0; w < allWeeks.length; w++) {
      const week = allWeeks[w];
      // Kiểm tra nếu bất kỳ ngày nào trong tuần này là ngày 1 hoặc chuyển sang tháng mới
      let targetMonth = new Date(week[0].date).getMonth();
      for (const d of week) {
        const dObj = new Date(d.date);
        if (dObj.getDate() === 1) {
          targetMonth = dObj.getMonth();
          break;
        }
      }

      if (targetMonth !== lastMonth && (w - lastLabeledWeek >= 3 || lastMonth === -1)) {
        monthLabelsMap[w] = `Thg ${targetMonth + 1}`;
        lastMonth = targetMonth;
        lastLabeledWeek = w;
      }
    }

    return {
      weeks: allWeeks,
      monthLabelsByWeek: monthLabelsMap,
      totalWordsInPeriod: totalWords,
      activeDaysCount: activeDays,
      totalXpInPeriod: totalXp,
    };
  }, [dailyHistory, timeRange]);

  // Màu sắc ô nhiệt
  const getCellColor = (day: HeatmapDay) => {
    if (day.isFuture) {
      return 'bg-slate-900/30 border-slate-900/50 cursor-default opacity-20';
    }

    switch (day.level) {
      case 4:
        return 'bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-400/50 hover:bg-emerald-300';
      case 3:
        return 'bg-emerald-500 border-emerald-400 shadow-sm shadow-emerald-500/30 hover:bg-emerald-400';
      case 2:
        return 'bg-emerald-700 border-emerald-600 hover:bg-emerald-600';
      case 1:
        return 'bg-emerald-950 border-emerald-800/80 hover:bg-emerald-900';
      default:
        return 'bg-slate-850/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800';
    }
  };

  const dayLabels = [
    { label: 'T2', index: 0 },
    { label: '', index: 1 },
    { label: 'T4', index: 2 },
    { label: '', index: 3 },
    { label: 'T6', index: 4 },
    { label: '', index: 5 },
    { label: 'CN', index: 6 },
  ];

  const handleCellHover = (e: React.MouseEvent<HTMLDivElement>, day: HeatmapDay) => {
    if (day.isFuture) {
      setHoveredDay(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredDay({
      day,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-5 w-full">
      
      {/* 1. Header & Bộ Chọn Khoảng Thời Gian */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>Biểu Đồ Nhiệt Học Tập</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-300 font-bold rounded-full border border-emerald-500/30">
                Activity Heatmap
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Theo dõi độ chăm chỉ và tần suất học tập đều đặn qua từng ngày
          </p>
        </div>

        {/* Nút chuyển đổi khoảng thời gian */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/80 border border-slate-800 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            onClick={() => {
              setTimeRange(13);
              setSelectedDay(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg transition-all ${
              timeRange === 13 ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            3 Tháng
          </button>
          <button
            onClick={() => {
              setTimeRange(24);
              setSelectedDay(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg transition-all ${
              timeRange === 24 ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            6 Tháng
          </button>
          <button
            onClick={() => {
              setTimeRange(52);
              setSelectedDay(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg transition-all ${
              timeRange === 52 ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            1 Năm
          </button>
        </div>
      </div>

      {/* 2. Bảng Thống Kê Nhanh (Đã làm sạch số liệu chuẩn từ hành động thực tế) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
          <div className="text-slate-400 text-[11px] font-medium">Tổng từ trong kỳ</div>
          <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
            {totalWordsInPeriod.toLocaleString()} <span className="text-[11px] text-emerald-400/80 font-normal">từ</span>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
          <div className="text-slate-400 text-[11px] font-medium">Số ngày hoạt động</div>
          <div className="text-base sm:text-lg font-black text-orange-400 mt-0.5">
            {activeDaysCount} <span className="text-[11px] text-orange-400/80 font-normal">ngày</span>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
          <div className="text-slate-400 text-[11px] font-medium">Kinh nghiệm tích lũy</div>
          <div className="text-base sm:text-lg font-black text-amber-400 mt-0.5">
            +{totalXpInPeriod.toLocaleString()} <span className="text-[11px] text-amber-400/80 font-normal">XP</span>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
          <div className="text-slate-400 text-[11px] font-medium">Chuỗi streak hiện tại</div>
          <div className="text-base sm:text-lg font-black text-rose-400 mt-0.5 flex items-center gap-1">
            <span>{profile.streak} ngày</span>
            <Flame className="w-4 h-4 fill-rose-500/30" />
          </div>
        </div>
      </div>

      {/* 3. Lưới Heatmap 100% Chiều Rộng Card & Nhãn Tháng Khớp Tuyệt Đối */}
      <div className="w-full overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-slate-800">
        <div className="min-w-[580px] w-full select-none pl-1 pr-3 py-1.5">
          
          <div className="flex w-full items-start gap-1.5 sm:gap-2">
            
            {/* Cột nhãn thứ (T2, T4, T6, CN) bên trái */}
            <div className="w-5 sm:w-6 shrink-0 flex flex-col gap-1 sm:gap-1.5 text-[10px] font-bold text-slate-500 text-right pr-1">
              {/* Khoảng đệm đỉnh h-5 khớp chính xác chiều cao hàng nhãn tháng */}
              <div className="h-5 shrink-0" />
              {dayLabels.map((d, i) => (
                <div
                  key={i}
                  className="w-full aspect-square flex items-center justify-end leading-none"
                >
                  {d.label}
                </div>
              ))}
            </div>

            {/* Lưới các cột tuần: Phủ kín 100% chiều rộng bằng gridTemplateColumns động */}
            <div
              className="flex-1 w-full gap-1 sm:gap-1.5 pr-1"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${timeRange}, minmax(0, 1fr))`,
              }}
            >
              {weeks.map((week, weekIdx) => {
                const monthLabel = monthLabelsByWeek[weekIdx];
                const isNearEnd = weekIdx >= timeRange - 2;

                return (
                  <div key={weekIdx} className="flex flex-col gap-1 sm:gap-1.5 w-full">
                    {/* Ô nhãn tháng: Nằm ngay trên cột tuần bắt đầu của tháng đó */}
                    <div className={`h-5 flex items-end text-[10px] sm:text-[11px] font-bold text-slate-400 whitespace-nowrap overflow-visible leading-none pb-0.5 ${
                      isNearEnd ? 'justify-end pr-0.5' : 'justify-start'
                    }`}>
                      {monthLabel ? <span>{monthLabel}</span> : null}
                    </div>

                    {/* 7 Ô ngày trong tuần (T2 đến CN) */}
                    {week.map((day, dayIdx) => {
                      const isSelected = selectedDay?.date === day.date;

                      return (
                        <div
                          key={dayIdx}
                          onClick={() => !day.isFuture && setSelectedDay(day)}
                          onMouseEnter={(e) => handleCellHover(e, day)}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`w-full aspect-square rounded-[3px] sm:rounded-md border transition-all duration-150 cursor-pointer relative ${getCellColor(
                            day
                          )} ${
                            day.isToday
                              ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-950 font-bold z-10'
                              : ''
                          } ${
                            isSelected
                              ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-950 scale-110 z-20'
                              : ''
                          }`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      </div>

      {/* 4. Tooltip Tương Tác Khi Hover Chuột */}
      {hoveredDay && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 bg-slate-950/95 border border-slate-700/90 rounded-xl shadow-2xl backdrop-blur-md text-xs transition-opacity animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: hoveredDay.x,
            top: hoveredDay.y - 8,
          }}
        >
          <div className="font-bold text-white flex items-center gap-1.5">
            <span className={hoveredDay.day.wordsCount > 0 ? 'text-emerald-400' : 'text-slate-500'}>●</span>
            <span>{hoveredDay.day.formattedDate}</span>
            {hoveredDay.day.isToday && (
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-400/20 text-amber-300 font-bold rounded">
                Hôm nay
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-300 mt-1">
            {hoveredDay.day.wordsCount > 0 ? (
              <span className="font-medium">
                <strong className="text-emerald-400 font-black">{hoveredDay.day.wordsCount} từ</strong> đã học •{' '}
                <strong className="text-amber-400 font-black">+{hoveredDay.day.xpGained} XP</strong>
              </span>
            ) : (
              <span className="text-slate-400">Không có hoạt động học tập</span>
            )}
          </div>
        </div>
      )}

      {/* 5. Thẻ Xem Chi Tiết Cho Mobile & Cảm Ứng */}
      {selectedDay && (
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <div>
              <span className="font-bold text-white">Chi tiết ngày {selectedDay.formattedDate}:</span>{' '}
              {selectedDay.wordsCount > 0 ? (
                <span className="text-slate-300">
                  Đã học <strong className="text-emerald-400">{selectedDay.wordsCount} từ vựng</strong>, nhận được{' '}
                  <strong className="text-amber-400">+{selectedDay.xpGained} XP</strong>.
                </span>
              ) : (
                <span className="text-slate-400">Không có hoạt động học tập vào ngày này.</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setSelectedDay(null)}
            className="text-slate-500 hover:text-slate-300 text-[11px] font-bold px-2 py-1 rounded hover:bg-slate-900 transition-colors"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 6. Footer: Chú Thích Cấp Độ Nhiệt */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Dữ liệu đồng bộ tự động theo tương tác học thực tế của bạn (+1 từ/lượt ôn)</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-500">Ít</span>
          <div className="w-3.5 h-3.5 rounded bg-slate-850/80 border border-slate-800" title="0 từ" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-950 border border-emerald-800/80" title="1 - 5 từ" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-700 border border-emerald-600" title="6 - 11 từ" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-400" title="12 - 20 từ" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-400 border border-emerald-300 shadow-sm shadow-emerald-400/40" title="> 20 từ" />
          <span className="text-slate-500">Nhiều</span>
        </div>
      </div>

    </div>
  );
};

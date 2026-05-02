import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarProps {
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  taskCounts?: Record<string, number>; // ISO date strings to count of tasks
  taskDates?: Set<string>;
}

export function Calendar({ selectedDate, onSelectDate, taskCounts, taskDates }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const handlePrev = () => setCurrentMonth(new Date(year, month - 1, 1));
  const handleNext = () => setCurrentMonth(new Date(year, month + 1, 1));

  const handleDayClick = (day: number) => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (selectedDate === formattedDate) {
      onSelectDate(null); // deselect
    } else {
      onSelectDate(formattedDate);
    }
  };

  const getDayClass = (day: number) => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    let base = "cal-day-cell";
    if (selectedDate === formattedDate) base += " selected";
    else if ((taskCounts && taskCounts[formattedDate] > 0) || (taskDates && taskDates.has(formattedDate))) base += " has-task";
    return base;
  };

  return (
    <div className="calendar-v3 ds-glass ds-aura ds-glass-shine">
      <div className="calendar-header-v3">
        <div className="calendar-title-group">
          <div className="calendar-month-text">
            {currentMonth.toLocaleString("default", { month: "long" })} <span>{year}</span>
          </div>
          <div className="calendar-system-tag">TEMPORAL_COORDINATES_V3.0</div>
        </div>
        <div className="calendar-nav-v3">
          <button className="cal-nav-btn" onClick={handlePrev}>
            <ChevronLeft size={16} />
          </button>
          <button className="cal-nav-btn" onClick={handleNext}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(d => (
          <div key={d} className="cal-header-cell-v3">{d}</div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="cal-day-cell-v3 empty" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = new Date().toISOString().split("T")[0] === formattedDate;

          const count = taskCounts ? (taskCounts[formattedDate] || 0) : 0;
          const hasTask = taskDates ? taskDates.has(formattedDate) : count > 0;
          const intensity = Math.min(count * 0.15, 0.6); // Scale intensity based on count
          
          return (
            <div 
              key={day} 
              className={getDayClass(day) + "-v3"} 
              onClick={() => handleDayClick(day)}
              style={(count > 0 || hasTask) && selectedDate !== formattedDate ? { background: `rgba(168, 168, 255, ${0.05 + intensity})` } : {}}
            >
              <div className="cal-cell-inner">
                <span className={isToday ? "today-marker-v3" : ""}>{day}</span>
                {(count > 0 || hasTask) && (
                  <div className="cal-gate-indicator">
                    <div className="cal-gate-pulse" />
                  </div>
                )}
                {count > 1 && <span className="cal-count-badge">{count}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

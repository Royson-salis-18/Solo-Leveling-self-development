import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarProps {
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  taskDates?: Set<string>; // ISO date strings like "2024-05-12" that have tasks
}

export function Calendar({ selectedDate, onSelectDate, taskDates }: CalendarProps) {
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
    else if (taskDates?.has(formattedDate)) base += " has-task";
    return base;
  };

  return (
    <div className="panel" style={{ padding: "16px" }}>
      <div className="flex-between mb-16">
        <div className="font-600 text-sm">
          {currentMonth.toLocaleString("default", { month: "long" })} {year}
        </div>
        <div className="flex gap-4">
          <button className="btn btn-secondary btn-sm" onClick={handlePrev} style={{ padding: "4px 8px" }}>
            <ChevronLeft size={14} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleNext} style={{ padding: "4px 8px" }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="cal-header-cell">{d}</div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="cal-day-cell empty" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = new Date().toISOString().split("T")[0] === formattedDate;

          return (
            <div key={day} className={getDayClass(day)} onClick={() => handleDayClick(day)}>
              <span className={isToday ? "today-marker" : ""}>{day}</span>
              {taskDates?.has(formattedDate) && <div className="cal-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function calculateNextDeadline(task: any, referenceDate?: Date): string {
  const rType = task.recurrence_type || "daily";
  const rInterval = task.recurrence_interval || 1;
  const start = referenceDate || new Date();
  const nextDate = new Date(start);
  
  if (rType === "interval" || rType === "daily") {
    nextDate.setDate(nextDate.getDate() + rInterval);
  } else if (rType === "weekly") {
    let rdays: number[] = [];
    try { rdays = task.recurrence_days ? (typeof task.recurrence_days === 'string' ? JSON.parse(task.recurrence_days) : task.recurrence_days) : []; } catch { rdays = []; }
    if (rdays.length > 0) {
      let found = false;
      for (let i = 1; i <= 7; i++) {
        nextDate.setDate(nextDate.getDate() + 1);
        if (rdays.includes(nextDate.getDay())) {
          found = true;
          break;
        }
      }
      if (!found) nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setDate(nextDate.getDate() + 7);
    }
  } else if (rType === "monthly") {
    const dayOfMonth = task.recurrence_day_of_month || 1;
    nextDate.setMonth(nextDate.getMonth() + 1);
    nextDate.setDate(dayOfMonth);
  } else {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  
  return nextDate.toISOString().split("T")[0];
}

export function findNextValidDeadline(task: any): string {
  const today = new Date().toISOString().split("T")[0];
  let current = task.deadline || today;
  
  // If it's already today or in the future, just return it
  if (current >= today) return current;
  
  // Otherwise, keep calculating next until we hit today or future
  let next = current;
  let safety = 0;
  while (next < today && safety < 100) {
    next = calculateNextDeadline(task, new Date(next + "T12:00:00"));
    safety++;
  }
  return next;
}



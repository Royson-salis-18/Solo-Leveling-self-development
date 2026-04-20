/**
 * Structured Logging System
 * Provides consistent logging across the application
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Log {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  stackTrace?: string;
}

class Logger {
  private logs: Log[] = [];
  private isDev = import.meta.env.DEV;
  private maxLogs = 500; // Keep last 500 logs in memory

  /**
   * Debug level
   */
  debug(message: string, context?: Record<string, unknown>) {
    this.log("debug", message, context);
  }

  /**
   * Info level
   */
  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  /**
   * Warning level
   */
  warn(message: string, context?: Record<string, unknown>) {
    this.log("warn", message, context);
  }

  /**
   * Error level
   */
  error(message: string, context?: Record<string, unknown>, error?: Error) {
    const stackTrace = error?.stack;
    this.log("error", message, context, stackTrace);
  }

  /**
   * Log with specific level
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    stackTrace?: string
  ) {
    const log: Log = {
      level,
      message,
      timestamp: new Date(),
      context,
      stackTrace,
    };

    this.logs.push(log);

    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output in development
    if (this.isDev) {
      const color = this.getColor(level);
      const timestamp = log.timestamp.toISOString().split("T")[1];
      console.log(
        `%c[${timestamp}] ${level.toUpperCase()}%c ${message}`,
        `color: ${color}; font-weight: bold;`,
        "color: inherit;"
      );

      if (context && Object.keys(context).length > 0) {
        console.log("  Context:", context);
      }

      if (stackTrace) {
        console.log("  Stack:", stackTrace);
      }
    }
  }

  /**
   * Get color for console log
   */
  private getColor(level: LogLevel): string {
    const colors = {
      debug: "#888888",
      info: "#0099ff",
      warn: "#ff9900",
      error: "#ff0064",
    };
    return colors[level];
  }

  /**
   * Get all logs
   */
  getLogs(): Log[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): Log[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Get logs by date range
   */
  getLogsByDateRange(startDate: Date, endDate: Date): Log[] {
    return this.logs.filter(
      (log) =>
        log.timestamp >= startDate &&
        log.timestamp <= endDate
    );
  }

  /**
   * Export logs as JSON for debugging
   */
  exportAsJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
  }

  /**
   * Download logs as file (for support)
   */
  downloadLogs(filename = `logs-${new Date().toISOString()}.json`) {
    const data = this.exportAsJSON();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get last N logs
   */
  getLastLogs(count: number): Log[] {
    return this.logs.slice(-count);
  }

  /**
   * Search logs by message
   */
  searchByMessage(keyword: string): Log[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.logs.filter((log) =>
      log.message.toLowerCase().includes(lowerKeyword)
    );
  }
}

// Singleton instance
export const logger = new Logger();

// Make available globally in development
if (import.meta.env.DEV) {
  (window as any).logger = logger;
  console.log("💡 Logger available as window.logger");
}

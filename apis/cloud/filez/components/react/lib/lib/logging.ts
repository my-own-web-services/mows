type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";

export class Logger {
    static fileFilter: Record<string, LogLevel> = {
        HotkeyManager: "ERROR"
    };

    static defaultLevel: LogLevel = "TRACE";

    private logLevels: Record<LogLevel, number> = {
        TRACE: 0,
        DEBUG: 1,
        INFO: 2,
        WARN: 3,
        ERROR: 4
    };

    private getTimestamp(): string {
        const now = new Date();
        return now.toTimeString().split(" ")[0];
    }

    private getCallerInfo(): { file: string; line: number; stack: string } | null {
        const stackLines = Error().stack?.split("\n");
        if (!stackLines) return null;

        const callerLine = stackLines[4];
        if (!callerLine) return null;

        const match = callerLine.match(/([^\/]+):(\d+):\d+/);
        if (!match) return null;

        return {
            file: match[1].replace(/\?.*$/, ""),
            line: parseInt(match[2]),
            stack: stackLines.slice(4).join("\n")
        };
    }

    private shouldLog(level: LogLevel, file: string): boolean {
        // Check for specific file filters first
        for (const [filePattern, minLevel] of Object.entries(Logger.fileFilter)) {
            if (file.includes(filePattern)) {
                return this.logLevels[level] >= this.logLevels[minLevel];
            }
        }

        // If no specific filter matches, use the default level
        return this.logLevels[level] >= this.logLevels[Logger.defaultLevel];
    }

    private log(level: LogLevel, color: string, ...args: any[]) {
        const caller = this.getCallerInfo();
        if (!caller) return;

        if (!this.shouldLog(level, caller.file)) {
            return;
        }

        const timestamp = this.getTimestamp();
        const styles: string[] = ["color:gray;", `color:${color};`, "color:gray;"];

        let messagePart = `${timestamp} %c${level.padEnd(5)} %c${caller.file}:${caller.line}: `;
        args.forEach((arg) => {
            if (typeof arg === "object" && arg !== null) {
                messagePart += "%c[expand] ";
                styles.push("color:lightcoral;");
            } else {
                messagePart += `%c${arg} `;
                styles.push(arg === null ? "color:gray;" : "");
            }
        });

        console.groupCollapsed(`%c${messagePart.trim()}`, ...styles);
        args.forEach((arg) => {
            if (typeof arg === "object" && arg !== null) console.log(arg);
        });
        console.log(caller.stack);
        console.groupEnd();
    }

    info(...args: any[]) {
        this.log("INFO", "lime", ...args);
    }

    warn(...args: any[]) {
        this.log("WARN", "yellow", ...args);
    }

    error(...args: any[]) {
        this.log("ERROR", "red", ...args);
    }

    debug(...args: any[]) {
        this.log("DEBUG", "blue", ...args);
    }

    trace(...args: any[]) {
        this.log("TRACE", "cyan", ...args);
    }
}

export const log = new Logger();

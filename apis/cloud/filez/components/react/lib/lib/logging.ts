import { FILEZ_LOG_LEVEL_LOCAL_STORAGE_KEY } from "./constants";

type LogLevel = `TRACE` | `DEBUG` | `INFO` | `WARN` | `ERROR`;

interface LogConfig {
	defaultLevel: LogLevel;
	fileFilter: Record<string, LogLevel>;
}

export class Logger {
	static fileFilter: Record<string, LogLevel> = {
		HotkeyManager: `DEBUG`
	};

	static defaultLevel: LogLevel = `ERROR`;
	enableCallerInfo: boolean = true;

	static loadConfig = (): void => {
		if (typeof window === `undefined`) return;

		try {
			const stored = localStorage.getItem(FILEZ_LOG_LEVEL_LOCAL_STORAGE_KEY);
			if (stored) {
				const config: LogConfig = JSON.parse(stored);
				Logger.defaultLevel = config.defaultLevel;
				Logger.fileFilter = config.fileFilter;
			}
		} catch (error) {
			console.error(`Failed to load logging config from localStorage:`, error);
		}
	};

	static saveConfig = (): void => {
		if (typeof window === `undefined`) return;

		try {
			const config: LogConfig = {
				defaultLevel: Logger.defaultLevel,
				fileFilter: Logger.fileFilter
			};
			localStorage.setItem(FILEZ_LOG_LEVEL_LOCAL_STORAGE_KEY, JSON.stringify(config));
		} catch (error) {
			console.error(`Failed to save logging config to localStorage:`, error);
		}
	};

    private logLevels: Record<LogLevel, number> = {
        TRACE: 0,
        DEBUG: 1,
        INFO: 2,
        WARN: 3,
        ERROR: 4
    };

    private getTimestamp = (): string => {
        const now = new Date();
        return now.toTimeString().split(` `)[0];
    };

    private getCallerInfo = (): { file: string; line: number; stack?: string } | null => {
        const stackLines = Error().stack?.split(`\n`);
        if (!stackLines) return null;

        const callerLine = stackLines[4];
        if (!callerLine) return null;

        const match = callerLine.match(/([^/]+):(\d+):\d+/);
        if (!match) return null;

        return {
            file: match[1].replace(/\?.*$/, ``),
            line: parseInt(match[2]),
            stack: this.enableCallerInfo ? stackLines.slice(4).join(`\n`) : undefined
        };
    };

    private shouldLog = (level: LogLevel, file: string): boolean => {
        // Check for specific file filters first
        for (const [filePattern, minLevel] of Object.entries(Logger.fileFilter)) {
            if (file.includes(filePattern)) {
                return this.logLevels[level] >= this.logLevels[minLevel];
            }
        }

        // If no specific filter matches, use the default level
        return this.logLevels[level] >= this.logLevels[Logger.defaultLevel];
    };

    private log = (level: LogLevel, color: string, ...args: any[]): void => {
        const caller = this.getCallerInfo();
        if (!caller) return;

        if (!this.shouldLog(level, caller.file)) {
            return;
        }

        const timestamp = this.getTimestamp();
        const styles: string[] = [`color:gray;`, `color:${color};`, `color:gray;`];

        let messagePart = `${timestamp} %c${level.padEnd(5)} %c${caller.file}:${caller.line}: `;
        args.forEach((arg) => {
            if (typeof arg === `object` && arg !== null) {
                messagePart += `%c[expand] `;
                styles.push(`color:lightcoral;`);
            } else {
                messagePart += `%c${arg} `;
                styles.push(arg === null ? `color:gray;` : ``);
            }
        });

        console.groupCollapsed(`%c${messagePart.trim()}`, ...styles);
        args.forEach((arg) => {
            if (typeof arg === `object` && arg !== null) console.log(arg);
        });
        if (caller.stack) {
            console.log(caller.stack);
        }
        console.groupEnd();
    };

    info = (...args: any[]): void => {
        this.log(`INFO`, `lime`, ...args);
    };

    warn = (...args: any[]): void => {
        this.log(`WARN`, `yellow`, ...args);
    };

    error = (...args: any[]): void => {
        this.log(`ERROR`, `red`, ...args);
    };

    debug = (...args: any[]): void => {
        this.log(`DEBUG`, `blue`, ...args);
    };

    trace = (...args: any[]): void => {
        this.log(`TRACE`, `cyan`, ...args);
    };
}

export const log = new Logger();

// Load saved configuration from localStorage
Logger.loadConfig();

// Expose Logger to window for configuration in tests and debugging
declare global {
	interface Window {
		FilezLogger?: typeof Logger;
		filezLog?: Logger;
	}
}

if (typeof window !== `undefined`) {
	window.FilezLogger = Logger;
	window.filezLog = log;
}

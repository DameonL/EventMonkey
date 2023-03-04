const packageJson = require("./package.json"); // Using require instead of import so it doesn't have to be in the src directory.

enum LoggingSeverity {
  Info,
  Warning,
  Error,
}

const logger = {
  log: (message: string, objectToLog?: any) => logMessage(LoggingSeverity.Info, message, objectToLog),
  warn: (message: string, objectToLog?: any) => logMessage(LoggingSeverity.Warning, message, objectToLog),
  error: (message: string, objectToLog?: any) => logMessage(LoggingSeverity.Error, message, objectToLog),
};

const prefix = `[eventMonkey ${packageJson.version}]: `;

function logMessage(severity: LoggingSeverity, logMessage: string, objectToLog?: any) {
  const logFunction =
    severity === LoggingSeverity.Info
      ? console.log
      : severity === LoggingSeverity.Warning
      ? console.warn
      : console.error;

  logFunction(`${prefix}${logMessage}`);
  if (objectToLog) {
    logFunction(`${prefix}${JSON.stringify(objectToLog)}`);
    if (severity === LoggingSeverity.Error) {
      console.trace();
    }
  }
}

export default logger;

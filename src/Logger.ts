const packageJson = require("./package.json"); // Using require instead of import so it doesn't have to be in the src directory.

enum LoggingSeverity {
  Info,
  Warning,
  Error,
}

const logger = {
  log: (message: any, objectToLog?: any) => logMessage(LoggingSeverity.Info, message, objectToLog),
  warn: (message: any, objectToLog?: any) => logMessage(LoggingSeverity.Warning, message, objectToLog),
  error: (message: any, objectToLog?: any) => logMessage(LoggingSeverity.Error, message, objectToLog),
};

function prefix() {return `${new Date().toISOString()} [eventMonkey ${packageJson.version}]: `;}

function logMessage(severity: LoggingSeverity, logMessage: any, objectToLog?: any) {
  const logFunction =
    severity === LoggingSeverity.Info
      ? console.log
      : severity === LoggingSeverity.Warning
      ? console.warn
      : console.error;

  if ((typeof logMessage))
  logFunction(`${prefix()}${(typeof logMessage) === "string" ? logMessage : logMessage.toString()}`);
  if (objectToLog) {
    logFunction(`${prefix()}${JSON.stringify(objectToLog)}`);
    if (severity === LoggingSeverity.Error) {
      console.trace(objectToLog);
    }
  }
}

export default logger;

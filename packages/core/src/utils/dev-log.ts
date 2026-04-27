type LogFn = (msg: string, data?: unknown) => void;

const noop: LogFn = () => {};

const makeLogger = () => ({
  info: (msg: string, data?: unknown) => console.log(`[WireAI] ${msg}`, data),
  warn: (msg: string, data?: unknown) => console.warn(`[WireAI] ${msg}`, data),
  error: (msg: string, data?: unknown) => console.error(`[WireAI] ${msg}`, data),
});

export const devLog = __DEV__ ? makeLogger() : { info: noop, warn: noop, error: noop };

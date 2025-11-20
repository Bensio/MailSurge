/**
 * Simple logger utility for development and production
 * In production, only errors are logged
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  debug: (label: string, ...args: unknown[]) => {
    if (isDevelopment) {
      console.log(`[${label}]`, ...args);
    }
  },
};




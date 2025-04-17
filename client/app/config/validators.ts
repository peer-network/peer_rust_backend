
// Get required environment variable
export function getRequiredEnvString(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not defined`);
  }
  return value;
}

export function getRequiredEnvNumber(key: string): number {
  return getAndValidateIntValue(key);
}

// Get optional environment variable with default
function getOptionalEnv<T>(key: string, defaultValue: T, transform?: (value: string) => T): T {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return transform ? transform(value) : (value as unknown as T);
}

function getAndValidateIntValue(key: string): number {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${value} is not defined`);
  }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${value} must be a valid integer`);
    }
    if (parsed < 0) {
      throw new Error(`Environment variable ${value} must be a positive number`);
    }
    return parsed;
}

// // Get environment variable as enum
// export function getEnumEnv<T extends string>(key: string, defaultValue: T, allowedValues: T[]): T {
//   return getOptionalEnv(key, defaultValue, (value) => {
//     if (!allowedValues.includes(value as T)) {
//       throw new Error(`Environment variable ${key} must be one of: ${allowedValues.join(', ')}`);
//     }
//     return value as T;
//   });
// }

// // Get environment variable as boolean
// export function getBoolEnv(key: string, defaultValue: boolean): boolean {
//   return getOptionalEnv(key, defaultValue, (value) => {
//     const lowercased = value.toLowerCase();
//     if (lowercased === 'true') return true;
//     if (lowercased === 'false') return false;
//     throw new Error(`Environment variable ${key} must be 'true' or 'false'`);
//   });
// }

// export function getNumberEnv(key: string, defaultValue: number): number {
//   const value = process.env[key];
//   if (!value) return defaultValue;
  
//   const num = Number(value);
//   return isNaN(num) ? defaultValue : num;
// } 
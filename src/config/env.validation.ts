type Environment = Record<string, string | undefined>;

export function validateEnv(config: Environment): Environment {
  const required = ['DATABASE_URL'];
  const missing = required.filter((key) => !config[key]);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (config.NODE_ENV === 'production' && !config.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  const uploadMaxFileSize = Number(config.UPLOAD_MAX_FILE_SIZE ?? 10485760);
  if (!Number.isInteger(uploadMaxFileSize) || uploadMaxFileSize <= 0) {
    throw new Error('UPLOAD_MAX_FILE_SIZE must be a positive integer');
  }

  return config;
}

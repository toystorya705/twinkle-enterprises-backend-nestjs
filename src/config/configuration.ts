export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    globalPrefix: process.env.API_PREFIX ?? 'api',
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'replace-this-development-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    refreshExpiresInDays: Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7),
    rememberMeRefreshExpiresInDays: Number(process.env.JWT_REMEMBER_ME_EXPIRES_IN_DAYS ?? 30),
  },
  uploads: {
    destination: process.env.UPLOAD_DESTINATION ?? 'uploads',
    maxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE ?? 10485760),
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
    allowedMimeTypes: (process.env.UPLOAD_ALLOWED_MIME_TYPES ?? 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  },
  frontend: {
    baseUrl: process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173',
  },
  email: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
  security: {
    trustProxy: process.env.TRUST_PROXY === 'true',
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
    bodyLimit: process.env.REQUEST_BODY_LIMIT ?? '1mb',
  },
});

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
  },
  uploads: {
    destination: process.env.UPLOAD_DESTINATION ?? 'uploads',
    maxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE ?? 10485760),
  },
});

export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgres://app:app@localhost:5432/app',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'opencode-secret',
  },
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      bucket: process.env.S3_BUCKET,
      accessKey: process.env.S3_ACCESS_KEY,
      secretKey: process.env.S3_SECRET_KEY,
    },
  },
  setup: {
    secret: process.env.SETUP_SECRET || '',
  },
});

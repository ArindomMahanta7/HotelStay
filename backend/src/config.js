import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? "hotelstay_dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
};

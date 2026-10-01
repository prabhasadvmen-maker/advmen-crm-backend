import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5001').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),

  APP_NAME: z.string().default('ADVMEN_SalesOS'),
  CLIENT_URL: z.string().default('http://localhost:3000'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().default('advmen_cookie_secure_signature_secret_key_2026'),

  SUPER_ADMIN_EMAIL: z.string().optional().default(''),
  SUPER_ADMIN_PASSWORD: z.string().optional().default(''),

  MONGODB_URI: z.string().default('mongodb+srv://admin:salesos2026@cluster0.mongodb.net/advmen_salesos?retryWrites=true&w=majority'),
  REDIS_HOST: z.string().default('localhost'),

  REDIS_PORT: z.string().default('6379').transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional().default(''),

  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('1000').transform((val) => parseInt(val, 10)),

  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_MODEL: z.string().default('nvidia/nemotron-3-super-120b-a12b:free'),


  GEMINI_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),


  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
  AWS_S3_BUCKET_NAME: z.string().default('advmen-salesos-assets'),

  // SMTP Email (nodemailer) — configure with Gmail App Password or any SMTP provider
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587').transform((v) => parseInt(v, 10)),
  SMTP_SECURE: z.string().default('false').transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('ADVMEN SalesOS <noreply@advmen.io>'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid Backend Environment Variables:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;

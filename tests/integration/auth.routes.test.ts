import supertest from 'supertest';
import { createApp } from '../../src/app.js';

describe('Auth Routes Integration Suite', () => {
  const app = createApp();
  const request = supertest(app);

  describe('GET /health/live', () => {
    it('returns HTTP 200 OK with health probe status', async () => {
      const response = await request.get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('UP');
      expect(response.headers).toHaveProperty('x-request-id');
    });
  });

  describe('POST /api/v1/auth/login validation', () => {
    it('returns HTTP 400/422 validation error when request body is empty or invalid', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({});

      expect([400, 422]).toContain(response.status);
    });

    it('attaches correlation X-Request-Id header on login requests', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'alexander@advmen.io',
          password: 'Password123!',
        });

      expect([200, 401, 500]).toContain(response.status);
      expect(response.headers).toHaveProperty('x-request-id');
    });
  });
});

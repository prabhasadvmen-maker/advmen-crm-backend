import supertest from 'supertest';
import { createApp } from '../../src/app.js';

describe('Deals API Integration Suite', () => {
  const app = createApp();
  const request = supertest(app);

  describe('GET /api/v1/deals unauthenticated protection', () => {
    it('returns HTTP 401 Unauthorized when missing authentication token', async () => {
      const response = await request.get('/api/v1/deals');
      expect(response.status).toBe(401);
    });
  });
});

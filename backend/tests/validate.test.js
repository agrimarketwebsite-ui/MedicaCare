// backend/tests/validate.test.js
// Phase 1 — unit tests para sa middleware/validate.js (zod).
// Tumakbo nang walang DB at walang Express: `node --test tests/validate.test.js`
// Gumagamit ng minimal req/res mocks.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

// Minimal Express-like mocks
const mockReq = (parts = {}) => ({ body: undefined, query: {}, params: {}, ...parts });
const mockRes = () => {
  const res = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.payload = body; return this; },
  };
  return res;
};

describe('validate() middleware', () => {
  it('valid body ay pumapasa at napupunta sa req.validated.body (parsed/coerced)', () => {
    const mw = validate({ body: z.object({ name: z.string().min(1), age: z.coerce.number().int() }) });
    const req = mockReq({ body: { name: 'Juan', age: '30' } });
    const res = mockRes();
    let nexted = false;
    mw(req, res, () => { nexted = true; });
    assert.equal(nexted, true);
    assert.deepEqual(req.validated.body, { name: 'Juan', age: 30 });
  });

  it('invalid body ay 400 na may safe field-level details (walang stack)', () => {
    const mw = validate({ body: z.object({ email: z.string().email() }).strict() });
    const req = mockReq({ body: { email: 'hindi-email' } });
    const res = mockRes();
    let nexted = false;
    mw(req, res, () => { nexted = true; });
    assert.equal(nexted, false);
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.success, false);
    assert.ok(Array.isArray(res.payload.details));
    assert.equal(res.payload.details[0].path, 'email');
    assert.ok(!('stack' in res.payload));
  });

  it('.strict() schema: unexpected field ay 400 (API3)', () => {
    const mw = validate({ body: z.object({ name: z.string() }).strict() });
    const req = mockReq({ body: { name: 'Juan', role: 'admin' } }); // role injection attempt
    const res = mockRes();
    mw(req, res, () => {});
    assert.equal(res.statusCode, 400);
  });

  it('query at params ay vina-validate rin', () => {
    const mw = validate({
      query: z.object({ q: z.string().min(1) }),
      params: z.object({ id: z.string().uuid() }),
    });
    const req = mockReq({
      query: { q: 'cardio' },
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
    });
    const res = mockRes();
    let nexted = false;
    mw(req, res, () => { nexted = true; });
    assert.equal(nexted, true);
    assert.equal(req.validated.query.q, 'cardio');
  });

  it('invalid params ay 400', () => {
    const mw = validate({ params: z.object({ id: z.string().uuid() }) });
    const req = mockReq({ params: { id: 'hindi-uuid' } });
    const res = mockRes();
    mw(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.details[0].path, 'id');
  });

  it('walang schema para sa part ay nilalaktawan (next agad)', () => {
    const mw = validate({});
    const req = mockReq({ body: { kahit: 'ano' } });
    const res = mockRes();
    let nexted = false;
    mw(req, res, () => { nexted = true; });
    assert.equal(nexted, true);
    assert.equal(res.statusCode, null);
  });
});

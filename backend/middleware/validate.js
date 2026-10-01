// backend/middleware/validate.js
// Phase 1 — totoong implementation (dating blueprint stub).
// Role: generic (zod schema) => req.body/query/params sanitizer.
// Gamit: validate({ body: schema, query: schema, params: schema })
// Security (API3 Broken Object Property Authorization / ASVS V5.1):
//   - Ang mga schema mismo ang dapat naka-.strict() (reject unknown fields) —
//     tingnan ang backend/modules/*/*.validation.js (Phase 2+).
//   - Ang middleware ay nagbabalik ng 400 na may SAFE field-level details
//     (path + message + code lang) — WALANG internal details, stack, o schema
//     dump sa response (ASVS V16.5).
//   - Ang na-parse na values ay inilalagay sa req.validated.{body,query,params};
//     ang controllers ay DAPAT doon kumuha, hindi sa raw req.body.

import { fail } from '../shared/utils/apiResponse.js';

const PARTS = ['body', 'query', 'params'];

const toDetails = (zodError) =>
  zodError.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
    code: issue.code,
  }));

/**
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} schemas
 * @returns Express middleware
 */
export const validate = (schemas = {}) => (req, res, next) => {
  try {
    req.validated = req.validated || {};
    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      // req.query values ay strings — ang coercion ay nasa schema (z.coerce.*).
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        return fail(res, 400, 'Hindi valid ang request.', toDetails(result.error));
      }
      req.validated[part] = result.data;
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

export default validate;

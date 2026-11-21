"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validateBody = void 0;
const zod_1 = require("zod");
const validateBody = (schema) => {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
                });
            }
            return res.status(400).json({ success: false, error: 'Bad Request' });
        }
    };
};
exports.validateBody = validateBody;
const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                return res.status(400).json({
                    success: false,
                    error: 'Query parameter validation failed',
                    details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
                });
            }
            return res.status(400).json({ success: false, error: 'Bad Request' });
        }
    };
};
exports.validateQuery = validateQuery;
//# sourceMappingURL=validate.js.map
'use strict';

const { z } = require('zod');

const telemetryExportQuerySchema = z.object({
  deviceId: z.string().trim().min(1).max(96).optional(),
  from: z.string().trim().max(64).optional(),
  to: z.string().trim().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50000).optional().default(10000),
});

module.exports = { telemetryExportQuerySchema };

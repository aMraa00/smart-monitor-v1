'use strict';

const express = require('express');
const controller = require('../controllers/reports.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireReportsAccess } = require('../middleware/reports.middleware');
const { telemetryExportQuerySchema } = require('../validators/reports.validator');

const router = express.Router();

router.use(authenticate, requireReportsAccess);

router.get('/summary', controller.getSummary);
router.get('/devices', controller.getDevices);
router.get('/export/devices.csv', controller.downloadDevicesCsv);
router.get(
  '/export/telemetry.csv',
  validate({ query: telemetryExportQuerySchema }),
  controller.downloadTelemetryCsv
);
router.get('/export/users.csv', controller.downloadUsersCsv);

module.exports = router;

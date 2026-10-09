'use strict';

const express = require('express');
const controller = require('../controllers/reports.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireReportsAccess } = require('../middleware/reports.middleware');

const router = express.Router();

router.use(authenticate, requireReportsAccess);

router.get('/summary', controller.getSummary);
router.get('/devices', controller.getDevices);
router.get('/export/devices.csv', controller.downloadDevicesCsv);
router.get('/export/users.csv', controller.downloadUsersCsv);

module.exports = router;

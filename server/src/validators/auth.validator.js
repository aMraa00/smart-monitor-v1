'use strict';

const { z } = require('zod');
const { email, password, pagination, objectId } = require('./common');

const registerSchema = z.object({
  email,
  password,
  name: z.string().trim().max(120).optional().default(''),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'password is required').max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'refreshToken is required'),
});

const createUserSchema = z.object({
  email,
  password,
  name: z.string().trim().max(120).optional().default(''),
  role: z.enum(['admin', 'manager', 'owner', 'viewer']).optional().default('owner'),
  canAccessReports: z.boolean().optional().default(false),
});

const listUsersQuerySchema = z.object({
  role: z.enum(['admin', 'manager', 'owner', 'viewer']).optional(),
  ...pagination,
});

const userIdParamsSchema = z.object({
  userId: objectId,
});

const updateUserSchema = z
  .object({
    email: email.optional(),
    name: z.string().trim().max(120).optional(),
    role: z.enum(['admin', 'manager', 'owner', 'viewer']).optional(),
    password: password.optional(),
    canAccessReports: z.boolean().optional(),
    extendReportsMonths: z.coerce.number().int().min(1).max(36).optional(),
    revokeReportsAccess: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'at least one field is required' });

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  createUserSchema,
  listUsersQuerySchema,
  userIdParamsSchema,
  updateUserSchema,
};

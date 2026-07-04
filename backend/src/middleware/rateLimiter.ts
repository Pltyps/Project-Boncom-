// Copyright (c) 2026 Navin. All rights reserved.
// SPDX-License-Identifier: MIT
// Project: quoted
//
// Rate limiter for public/auth endpoints. Serves two purposes at once (see
// references/scalability.md's security-scale intersection): it blocks
// brute-force/abuse attempts (security, OWASP A07) AND protects the service
// from being overwhelmed by a runaway or buggy client (stability).
import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // generous enough for real users, tight enough to blunt brute-force
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

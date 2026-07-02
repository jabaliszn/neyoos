/**
 * DEPRECATED 2026-07-01 — this script was found during a full-stack audit to
 * assert NOTHING (it just printed a count and a margin value and always
 * "passed" regardless of correctness). It also only ever exercised M.2, never
 * M.1 at all, and used hardcoded 0.8/1.2 KES prices that have since been
 * moved into NEYO Ops-configurable settings.
 *
 * The real, assertion-based full-stack test for BOTH M.1 (Referral Engine)
 * and M.2 (SMS Margin Revenue) is scripts/m1-m2-fullstack-test.ts — run that
 * one instead. This file is kept only so old references to it don't 404;
 * it delegates straight through.
 */
import { execSync } from "node:child_process";

execSync("./node_modules/.bin/tsx scripts/m1-m2-fullstack-test.ts", { stdio: "inherit" });

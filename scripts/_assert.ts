/**
 * Tiny zero-dependency test harness (used by NEYO test scripts).
 * Pretty names, clear pass/fail summary, non-zero exit on failure.
 */
let passed = 0;
let failed = 0;
const failures: string[] = [];

export function test(name: string, fn: () => void | Promise<void>) {
  try {
    const r = fn();
    if (r instanceof Promise) {
      throw new Error("use testAsync for async tests");
    }
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

export async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

export function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`expected falsy, got ${JSON.stringify(actual)}`);
    },
  };
}

export function group(name: string) {
  console.log(`\n${name}`);
}

export function summary(): never {
  console.log(`\n${"-".repeat(40)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`  failed: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("  ✅ all green");
  process.exit(0);
}

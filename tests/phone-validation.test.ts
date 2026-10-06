import { normalizeIndianPhone } from "../lib/validation/phone";

/**
 * Basic test runner for Indian phone normalization & validation.
 * Tests edge cases: 10-digit mobile, trunk 0 prefix, +91 prefix, spaces, invalid length, invalid prefix.
 */
function runPhoneTests() {
  console.log("Running Indian Phone Normalization Unit Tests...\n");

  const testCases: Array<{
    input: string;
    expectedValid: boolean;
    expectedNormalized: string | null;
  }> = [
    {
      input: "9849012345",
      expectedValid: true,
      expectedNormalized: "+919849012345",
    },
    {
      input: "09849012345",
      expectedValid: true,
      expectedNormalized: "+919849012345",
    },
    {
      input: "+91 98490-12345",
      expectedValid: true,
      expectedNormalized: "+919849012345",
    },
    {
      input: "919849012345",
      expectedValid: true,
      expectedNormalized: "+919849012345",
    },
    {
      input: "7001234567",
      expectedValid: true,
      expectedNormalized: "+917001234567",
    },
    {
      input: "6301234567",
      expectedValid: true,
      expectedNormalized: "+916301234567",
    },
    {
      input: "8123456789",
      expectedValid: true,
      expectedNormalized: "+918123456789",
    },
    // Invalid test cases
    {
      input: "5123456789", // Begins with 5 (not a valid Indian mobile number)
      expectedValid: false,
      expectedNormalized: null,
    },
    {
      input: "12345", // Too short
      expectedValid: false,
      expectedNormalized: null,
    },
    {
      input: "", // Empty
      expectedValid: false,
      expectedNormalized: null,
    },
    {
      input: "98490123456789", // Too long
      expectedValid: false,
      expectedNormalized: null,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const result = normalizeIndianPhone(tc.input);
    const validMatch = result.isValid === tc.expectedValid;
    const normMatch = result.normalized === tc.expectedNormalized;

    if (validMatch && normMatch) {
      console.log(`✅ PASS: "${tc.input}" -> ${result.normalized ?? "INVALID"}`);
      passed++;
    } else {
      console.error(
        `❌ FAIL: "${tc.input}" -> Got: isValid=${result.isValid}, normalized=${result.normalized}. Expected: isValid=${tc.expectedValid}, normalized=${tc.expectedNormalized}`
      );
      failed++;
    }
  }

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runPhoneTests();

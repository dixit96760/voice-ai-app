import { signUpSchema, signInSchema, resetPasswordSchema } from "../lib/validation/auth";

export function runAuthValidationTests() {
  console.log("Running Auth Validation Tests (Signup, Login, Password Reset)...");

  // 1. Valid Signup
  const validSignup = signUpSchema.safeParse({
    fullName: "Ramesh Sharma",
    email: "ramesh@abcproperties.in",
    password: "Password@123",
    confirmPassword: "Password@123",
  });
  if (!validSignup.success) {
    throw new Error(`Expected valid signup to succeed: ${JSON.stringify(validSignup.error)}`);
  }
  console.log("  ✅ Test 1: Valid signup accepted");

  // 2. Passwords mismatch
  const mismatchSignup = signUpSchema.safeParse({
    fullName: "Ramesh Sharma",
    email: "ramesh@abcproperties.in",
    password: "Password@123",
    confirmPassword: "DifferentPassword123",
  });
  if (mismatchSignup.success) {
    throw new Error("Expected signup with mismatched passwords to fail");
  }
  const mismatchIssue = mismatchSignup.error.issues.find((i) => i.path.includes("confirmPassword"));
  if (!mismatchIssue || mismatchIssue.message !== "Passwords do not match") {
    throw new Error("Expected 'Passwords do not match' error message");
  }
  console.log("  ✅ Test 2: Mismatched password rejected with clean error");

  // 3. Password too short (<8 chars)
  const shortPassSignup = signUpSchema.safeParse({
    fullName: "Ramesh Sharma",
    email: "ramesh@abcproperties.in",
    password: "short",
    confirmPassword: "short",
  });
  if (shortPassSignup.success) {
    throw new Error("Expected signup with short password to fail");
  }
  console.log("  ✅ Test 3: Password under 8 characters rejected");

  // 4. Invalid Email
  const invalidEmailSignup = signUpSchema.safeParse({
    fullName: "Ramesh Sharma",
    email: "not-an-email",
    password: "Password@123",
    confirmPassword: "Password@123",
  });
  if (invalidEmailSignup.success) {
    throw new Error("Expected invalid email to fail");
  }
  console.log("  ✅ Test 4: Malformed email rejected");

  // 5. Valid Login Credentials
  const validLogin = signInSchema.safeParse({
    email: "user@example.com",
    password: "validPassword123",
  });
  if (!validLogin.success) {
    throw new Error("Expected valid login schema parse to succeed");
  }
  console.log("  ✅ Test 5: Valid login format accepted");

  // 6. Invalid Login (empty password or malformed email)
  const emptyPassLogin = signInSchema.safeParse({
    email: "user@example.com",
    password: "",
  });
  if (emptyPassLogin.success) {
    throw new Error("Expected login with empty password to fail");
  }
  console.log("  ✅ Test 6: Empty password login rejected");

  // 7. Password Reset
  const validReset = resetPasswordSchema.safeParse({
    email: "owner@business.com",
  });
  if (!validReset.success) {
    throw new Error("Expected valid password reset email to succeed");
  }
  const invalidReset = resetPasswordSchema.safeParse({
    email: "not-an-email",
  });
  if (invalidReset.success) {
    throw new Error("Expected invalid password reset email to fail");
  }
  console.log("  ✅ Test 7: Password reset validation verified");
}

if (require.main === module) {
  runAuthValidationTests();
}

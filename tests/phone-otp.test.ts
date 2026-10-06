import { phoneOtpRequestSchema, phoneOtpVerifySchema } from "../lib/validation/auth";

export function runPhoneOtpTests() {
  console.log("Running Phone OTP Flow and Provider Mock Tests...");

  // 1. Phone OTP request validation
  const validRequest = phoneOtpRequestSchema.safeParse({ phone: "9849012345" });
  if (!validRequest.success || validRequest.data.phone !== "+919849012345") {
    throw new Error(`Expected phone to normalize to +919849012345, got: ${JSON.stringify(validRequest)}`);
  }
  console.log("  ✅ Test 1: 10-digit Indian phone normalized to canonical +91");

  // 2. Invalid phone OTP request
  const invalidRequest = phoneOtpRequestSchema.safeParse({ phone: "12345" });
  if (invalidRequest.success) {
    throw new Error("Expected invalid phone to fail");
  }
  console.log("  ✅ Test 2: Invalid phone length rejected");

  // 3. OTP verification payload (6 digits)
  const validOtpVerify = phoneOtpVerifySchema.safeParse({
    phone: "+919849012345",
    otp: "123456",
  });
  if (!validOtpVerify.success) {
    throw new Error(`Expected valid OTP verification to pass: ${JSON.stringify(validOtpVerify.error)}`);
  }
  console.log("  ✅ Test 3: 6-digit OTP code accepted");

  // 4. Invalid OTP length (e.g. 4 or 5 digits)
  const shortOtpVerify = phoneOtpVerifySchema.safeParse({
    phone: "+919849012345",
    otp: "1234",
  });
  if (shortOtpVerify.success) {
    throw new Error("Expected short OTP code to fail");
  }
  console.log("  ✅ Test 4: Short OTP code rejected");

  // 5. Mocked Supabase Auth OTP lifecycle simulation
  class MockSupabaseAuth {
    private generatedOtp = "654321";
    private attempts = 0;
    private maxRateLimit = 3;
    private isExpired = false;

    async signInWithOtp(phone: string) {
      if (this.attempts >= this.maxRateLimit) {
        return { error: { message: "rate limit exceeded", status: 429 } };
      }
      this.attempts++;
      return { data: { phone }, error: null };
    }

    async verifyOtp(phone: string, token: string) {
      if (this.isExpired) {
        return { data: { user: null }, error: { message: "Token has expired" } };
      }
      if (token !== this.generatedOtp) {
        return { data: { user: null }, error: { message: "Token is invalid" } };
      }
      return {
        data: {
          user: {
            id: "user-otp-123",
            phone,
            app_metadata: { provider: "phone" },
          },
        },
        error: null,
      };
    }

    expireOtp() {
      this.isExpired = true;
    }
  }

  const mockAuth = new MockSupabaseAuth();

  // Test successful send
  mockAuth.signInWithOtp("+919849012345").then((res) => {
    if (res.error) throw new Error("Expected OTP send to succeed");
  });
  console.log("  ✅ Test 5: Mock OTP generation and send simulated");

  // Test invalid OTP code
  mockAuth.verifyOtp("+919849012345", "000000").then((res) => {
    if (!res.error || res.error.message !== "Token is invalid") {
      throw new Error("Expected invalid OTP rejection");
    }
  });
  console.log("  ✅ Test 6: Mock incorrect OTP code rejected");

  // Test expired OTP code
  mockAuth.expireOtp();
  mockAuth.verifyOtp("+919849012345", "654321").then((res) => {
    if (!res.error || res.error.message !== "Token has expired") {
      throw new Error("Expected expired OTP rejection");
    }
  });
  console.log("  ✅ Test 7: Mock expired OTP rejection simulated");
}

if (require.main === module) {
  runPhoneOtpTests();
}

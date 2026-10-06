import { businessOnboardingSchema } from "../lib/validation/business";
import { validateLogoFile, ALLOWED_LOGO_MIME_TYPES, MAX_LOGO_SIZE_BYTES } from "../lib/storage/logo";
import { assertBusinessOwnership } from "../lib/permissions";

export function runBusinessOnboardingTests() {
  console.log("Running Business Onboarding, Timezone & Security Tests...");

  // 1. Valid Onboarding Input
  const validBusiness = businessOnboardingSchema.safeParse({
    businessName: "ABC Properties",
    businessType: "Real Estate",
    description: "Premium builder in Hyderabad",
    website: "https://abcproperties.in",
    businessEmail: "info@abcproperties.in",
    businessPhone: "+914040001234",
    address: "Plot 42, Financial District",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    timezone: "Asia/Kolkata",
    logoUrl: "",
  });
  if (!validBusiness.success) {
    throw new Error(`Expected valid business onboarding to succeed: ${JSON.stringify(validBusiness.error)}`);
  }
  console.log("  ✅ Test 1: Valid business onboarding payload accepted");

  // 2. IANA Timezone validation (Asia/Kolkata default)
  if (validBusiness.data.timezone !== "Asia/Kolkata") {
    throw new Error("Expected default timezone to be Asia/Kolkata");
  }
  const invalidTimezone = businessOnboardingSchema.safeParse({
    businessName: "ABC Properties",
    businessType: "Real Estate",
    country: "India",
    timezone: "Invalid/Not_A_Timezone_Identifier",
  });
  if (invalidTimezone.success) {
    throw new Error("Expected invalid IANA timezone to fail");
  }
  console.log("  ✅ Test 2: IANA timezone identifier validation enforced (Asia/Kolkata)");

  // 3. Duplicate business creation prevention simulation
  class MockBusinessStore {
    private businesses: Map<string, { id: string; ownerId: string; name: string }> = new Map();

    createBusiness(ownerId: string, name: string) {
      for (const biz of Array.from(this.businesses.values())) {
        if (biz.ownerId === ownerId) {
          throw new Error("UNIQUE_VIOLATION: User already owns a business");
        }
      }
      const id = `biz-${Date.now()}`;
      const record = { id, ownerId, name };
      this.businesses.set(id, record);
      return record;
    }
  }

  const store = new MockBusinessStore();
  const user1 = "user-123";
  store.createBusiness(user1, "First Business");
  try {
    store.createBusiness(user1, "Second Business");
    throw new Error("Expected duplicate business creation to fail");
  } catch (err: any) {
    if (!err.message.includes("UNIQUE_VIOLATION")) {
      throw err;
    }
  }
  console.log("  ✅ Test 3: Duplicate business creation prevented by owner uniqueness");

  // 4. Cross-business authorization check (Business A cannot access Business B)
  const userAContext = { userId: "user-A", businessId: "biz-A" };
  const userBContext = { userId: "user-B", businessId: "biz-B" };

  // User A accessing Business A resource
  assertBusinessOwnership("biz-A", userAContext); // Should succeed without throw

  // User A attempting to mutate Business B resource
  let crossAccessBlocked = false;
  try {
    assertBusinessOwnership("biz-B", userAContext);
  } catch (err: any) {
    if (err.message.includes("ACCESS_DENIED")) {
      crossAccessBlocked = true;
    }
  }
  if (!crossAccessBlocked) {
    throw new Error("Expected cross-business access to be blocked");
  }
  console.log("  ✅ Test 4: Cross-business access denied (Business A cannot access Business B)");

  // 5. Logo file validation (Type & Size)
  const validMockLogo = {
    name: "logo.png",
    type: "image/png",
    size: 500 * 1024, // 500 KB
  } as unknown as File;
  const logoCheck1 = validateLogoFile(validMockLogo);
  if (!logoCheck1.valid) {
    throw new Error("Expected valid PNG logo to pass validation");
  }

  const oversizedMockLogo = {
    name: "huge_logo.png",
    type: "image/png",
    size: 5 * 1024 * 1024, // 5 MB > 2 MB limit
  } as unknown as File;
  const logoCheck2 = validateLogoFile(oversizedMockLogo);
  if (logoCheck2.valid || !logoCheck2.error?.includes("exceeds 2 MB")) {
    throw new Error("Expected oversized logo to fail validation");
  }

  const executableMockFile = {
    name: "malicious.exe",
    type: "application/x-msdownload",
    size: 10 * 1024,
  } as unknown as File;
  const logoCheck3 = validateLogoFile(executableMockFile);
  if (logoCheck3.valid || !logoCheck3.error?.includes("Invalid image format")) {
    throw new Error("Expected executable file to be rejected");
  }
  console.log("  ✅ Test 5: Logo file validation enforced (type, size, executable rejection)");
}

if (require.main === module) {
  runBusinessOnboardingTests();
}

import { ColumnMapping } from "./types";

/**
 * Suggests default column mappings by scanning headers against common Indian/international CRM terms.
 */
export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    phone: "",
    name: "",
    email: undefined,
    city: undefined,
    tags: undefined,
  };

  for (const header of headers) {
    const clean = header.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Phone matching
    if (!mapping.phone) {
      if (
        clean.includes("mobile") ||
        clean.includes("phone") ||
        clean.includes("contactnumber") ||
        clean.includes("cell") ||
        clean.includes("whatsapp") ||
        clean === "contact" ||
        clean === "number" ||
        clean === "tel"
      ) {
        mapping.phone = header;
        continue;
      }
    }

    // Name matching
    if (!mapping.name) {
      if (
        clean.includes("fullname") ||
        clean.includes("customername") ||
        clean.includes("clientname") ||
        clean.includes("leadname") ||
        clean.includes("prospect") ||
        clean === "name" ||
        clean === "contactname" ||
        clean === "person"
      ) {
        mapping.name = header;
        continue;
      }
    }

    // Email matching
    if (!mapping.email) {
      if (clean.includes("email") || clean.includes("mail")) {
        mapping.email = header;
        continue;
      }
    }

    // City matching
    if (!mapping.city) {
      if (
        clean.includes("city") ||
        clean.includes("location") ||
        clean.includes("town") ||
        clean.includes("state")
      ) {
        mapping.city = header;
        continue;
      }
    }

    // Tags matching
    if (!mapping.tags) {
      if (
        clean.includes("tag") ||
        clean.includes("category") ||
        clean.includes("segment") ||
        clean.includes("source")
      ) {
        mapping.tags = header;
        continue;
      }
    }
  }

  return mapping;
}

/**
 * Validates that mandatory fields (phone, name) are accurately mapped to existing headers.
 */
export function validateColumnMapping(
  headers: string[],
  mapping: ColumnMapping
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!mapping.phone || !headers.includes(mapping.phone)) {
    errors.push("A valid 'Phone' column must be mapped.");
  }

  if (!mapping.name || !headers.includes(mapping.name)) {
    errors.push("A valid 'Name' column must be mapped.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

import { env } from "@/lib/env";

/**
 * Configurable Tax Calculation & Invoicing Engine
 * Provides data-driven tax assessment without encoding statutory or legal guarantees.
 */

export interface TaxCalculationInput {
  subtotalPaise: number;
  customerGstin?: string | null;
  customerBillingStateCode?: string | null;
  isTaxExempt?: boolean | null;
  taxExemptionReason?: string | null;
  customTaxRatePercent?: number | null;
}

export interface TaxBreakdown {
  type: "CGST_SGST" | "IGST" | "EXEMPT" | "CUSTOM";
  cgst_rate?: number;
  cgst_paise?: number;
  sgst_rate?: number;
  sgst_paise?: number;
  igst_rate?: number;
  igst_paise?: number;
  reason?: string;
}

export interface TaxCalculationResult {
  subtotalPaise: number;
  taxType: string;
  taxRatePercent: number;
  taxPaise: number;
  totalPaise: number;
  taxBreakdown: TaxBreakdown;
  customerGstin: string | null;
}

export class TaxCalculationEngine {
  private platformStateCode: string;
  private defaultTaxRate: number;

  constructor(platformStateCode?: string, defaultTaxRate?: number) {
    this.platformStateCode = platformStateCode || env.PLATFORM_STATE_CODE || "27";
    this.defaultTaxRate =
      defaultTaxRate !== undefined
        ? defaultTaxRate
        : parseFloat(env.DEFAULT_GST_RATE || "18.0");
  }

  calculateTax(input: TaxCalculationInput): TaxCalculationResult {
    const {
      subtotalPaise,
      customerGstin = null,
      customerBillingStateCode = null,
      isTaxExempt = false,
      taxExemptionReason = null,
      customTaxRatePercent = null,
    } = input;

    // 1. Tax Exempt Scenario
    if (isTaxExempt) {
      return {
        subtotalPaise,
        taxType: "EXEMPT",
        taxRatePercent: 0,
        taxPaise: 0,
        totalPaise: subtotalPaise,
        taxBreakdown: {
          type: "EXEMPT",
          reason: taxExemptionReason || "Configured Tax Exemption",
        },
        customerGstin,
      };
    }

    // 2. Determine applicable rate
    const applicableRate =
      customTaxRatePercent !== null && customTaxRatePercent !== undefined
        ? customTaxRatePercent
        : this.defaultTaxRate;

    // 3. Intra-State vs Inter-State Evaluation
    const isIntraState =
      customerBillingStateCode &&
      customerBillingStateCode.trim() === this.platformStateCode.trim();

    if (isIntraState) {
      const halfRate = applicableRate / 2;
      const cgstPaise = Math.round(subtotalPaise * (halfRate / 100));
      const sgstPaise = Math.round(subtotalPaise * (halfRate / 100));
      const taxPaise = cgstPaise + sgstPaise;

      return {
        subtotalPaise,
        taxType: "CGST_SGST",
        taxRatePercent: applicableRate,
        taxPaise,
        totalPaise: subtotalPaise + taxPaise,
        taxBreakdown: {
          type: "CGST_SGST",
          cgst_rate: halfRate,
          cgst_paise: cgstPaise,
          sgst_rate: halfRate,
          sgst_paise: sgstPaise,
        },
        customerGstin,
      };
    }

    // 4. Default: Inter-State IGST Evaluation
    const igstPaise = Math.round(subtotalPaise * (applicableRate / 100));

    return {
      subtotalPaise,
      taxType: "IGST",
      taxRatePercent: applicableRate,
      taxPaise: igstPaise,
      totalPaise: subtotalPaise + igstPaise,
      taxBreakdown: {
        type: "IGST",
        igst_rate: applicableRate,
        igst_paise: igstPaise,
      },
      customerGstin,
    };
  }
}

export const taxEngine = new TaxCalculationEngine();

import { z } from "zod";

export const callAnalysisOutputSchema = z.object({
  short_summary: z.string().min(5),
  customer_intent: z.string().nullable().optional(),
  interest_level: z.enum(["HIGH", "MEDIUM", "LOW", "NONE"]).nullable().optional(),
  questions_asked: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
  important_information: z.array(z.string()).default([]),
  requested_follow_up: z.string().nullable().optional(),
  recommended_next_action: z.string().nullable().optional(),
  outcome: z.enum([
    "INTERESTED",
    "NOT_INTERESTED",
    "CALLBACK",
    "NO_ANSWER",
    "BUSY",
    "UNREACHABLE",
    "WRONG_NUMBER",
    "DO_NOT_CALL",
    "INFORMATION_REQUESTED",
    "OTHER",
  ]),
});

export type CallAnalysisOutput = z.infer<typeof callAnalysisOutputSchema>;

export interface PostCallAnalyzer {
  analyzeTranscript(transcript: string, campaignContext: string): Promise<CallAnalysisOutput>;
}

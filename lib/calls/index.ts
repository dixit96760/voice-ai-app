import type { Database, CallStatus, CallOutcome, CallDirection } from "@/lib/supabase/types";

export type Call = Database["public"]["Tables"]["calls"]["Row"];
export type CallAttempt = Database["public"]["Tables"]["call_attempts"]["Row"];
export type CallTranscript = Database["public"]["Tables"]["call_transcripts"]["Row"];
export type CallRecording = Database["public"]["Tables"]["call_recordings"]["Row"];
export type CallAnalysis = Database["public"]["Tables"]["call_analysis"]["Row"];

export { CallStatus, CallOutcome, CallDirection };

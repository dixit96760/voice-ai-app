export function isDemoMode(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.AUTH_DEMO_MODE === "true"
  );
}

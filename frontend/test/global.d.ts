// The bundle smoke test imports the built (untyped) JS bundle directly, not
// TS source -- see bundle.smoke.test.ts for why.
declare module "*.js" {
  const value: unknown;
  export default value;
}

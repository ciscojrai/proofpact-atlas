/** Jest config for the ProofPact contract tests (INTERFACES §8). */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.cjs"],
  transform: {},
  verbose: true,
  testTimeout: 300_000,
};

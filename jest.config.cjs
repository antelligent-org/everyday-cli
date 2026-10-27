module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.ts"],
  // email-flow.test.ts calls the live API and sends real email; run it on
  // purpose with `npx jest test/email-flow.test.ts`, never by default.
  testPathIgnorePatterns: ["/node_modules/", "/test/email-flow.test.ts"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.ts"],
};

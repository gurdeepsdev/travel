module.exports = {
  testEnvironment: "node",

  verbose: true,

  collectCoverage: true,

  coverageDirectory: "coverage",

  coverageReporters: ["html", "text", "lcov"],

  reporters: [
    "default",

    [
      "jest-html-reporters",

      {
        publicPath: "./reports",

        filename: "test-report.html",

        expand: true,

        pageTitle: "Travel Platform Backend Test Report",

        hideIcon: false,

        includeFailureMsg: true,

        includeConsoleLog: true,
      },
    ],

    [
      "jest-junit",

      {
        outputDirectory: "./reports",

        outputName: "junit.xml",
      },
    ],
  ],
};

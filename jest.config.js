module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["**/tests/unit/**/*.spec.js"],
  // lets components import siblings without the .vue extension
  moduleFileExtensions: ["js", "json", "vue"],
  transform: {
    "^.+\\.vue$": "<rootDir>/tests/vueTransform.js",
    "^.+\\.js$": "babel-jest"
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(mp3|wav|png|jpg|gif|svg|woff|woff2|ttf|eot)$":
      "<rootDir>/tests/__mocks__/fileMock.js"
  },
  transformIgnorePatterns: ["/node_modules/"]
};

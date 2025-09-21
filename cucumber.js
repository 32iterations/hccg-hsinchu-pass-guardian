module.exports = {
  default: {
    require: ['features/step_definitions/**/*.js'],
    format: ['progress-bar', 'json:reports/cucumber-report.json'],
    publishQuiet: true,
    parallel: 1,
    retry: 0,
    failFast: false,
    strict: false  // Don't fail on undefined steps (treat as pending)
  }
};
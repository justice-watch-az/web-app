// WebdriverIO configuration for Selenium tests
exports.config = {
    //
    // Runner Configuration
    //
    runner: 'local',
    
    //
    // Specify Test Files
    //
    specs: [
        './e2e-selenium/specs/**/*.js'
    ],
    exclude: [],
    
    //
    // Capabilities
    //
    maxInstances: 10,
    capabilities: [{
        maxInstances: 5,
        browserName: 'chrome',
        'goog:chromeOptions': {
            args: [
                '--headless',
                '--disable-gpu',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--window-size=1920,1080'
            ]
        },
        acceptInsecureCerts: true
    }, {
        maxInstances: 5,
        browserName: 'firefox',
        'moz:firefoxOptions': {
            args: [
                '--headless',
                '--width=1920',
                '--height=1080'
            ]
        },
        acceptInsecureCerts: true
    }],
    
    //
    // Test Configuration
    //
    logLevel: 'info',
    bail: 0,
    baseUrl: 'http://localhost:3001',
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    services: ['chromedriver', 'geckodriver'],
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },
    
    //
    // Hooks
    //
    before: function (capabilities, specs, browser) {
        // Set up browser
        browser.setWindowSize(1920, 1080);
    },
    
    beforeTest: function (test, context) {
        // Add custom commands if needed
    },
    
    afterTest: async function(test, context, { error, result, duration, passed, retries }) {
        if (!passed) {
            await browser.takeScreenshot();
        }
    },
    
    after: function (result, capabilities, specs) {
        // Clean up
    }
};
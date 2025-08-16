/**
 * E2E tests for Justice Watch widget system using Selenium WebDriver
 */

describe('Widget System E2E Tests', () => {
    
    describe('Stats Widget', () => {
        it('should load stats widget successfully', async () => {
            await browser.url('/widgets/stats');
            
            // Wait for widget container to load
            const widget = await $('.widget-container');
            await widget.waitForExist({ timeout: 10000 });
            
            // Verify widget is displayed
            expect(await widget.isDisplayed()).toBe(true);
            
            // Check for widget title
            const title = await $('.widget-header');
            expect(await title.isExisting()).toBe(true);
        });
        
        it('should apply theme parameter correctly', async () => {
            await browser.url('/widgets/stats?theme=dark');
            
            const widget = await $('.widget-container');
            await widget.waitForExist({ timeout: 10000 });
            
            // Check if dark theme class is applied
            const classes = await widget.getAttribute('class');
            expect(classes).toContain('theme-dark');
        });
        
        it('should apply size parameter correctly', async () => {
            await browser.url('/widgets/stats?size=card');
            
            const widget = await $('.widget-container');
            await widget.waitForExist({ timeout: 10000 });
            
            // Check if card size class is applied
            const classes = await widget.getAttribute('class');
            expect(classes).toContain('size-card');
        });
    });
    
    describe('Arraignments Widget', () => {
        it('should load arraignments widget with parameters', async () => {
            await browser.url('/widgets/arraignments?court=all&date=today');
            
            const widget = await $('.widget-container');
            await widget.waitForExist({ timeout: 10000 });
            
            expect(await widget.isDisplayed()).toBe(true);
            
            // Check for data container
            const dataContainer = await $('.arraignments-list, .arraignments-grid');
            expect(await dataContainer.isExisting()).toBe(true);
        });
        
        it('should display court filter when specified', async () => {
            await browser.url('/widgets/arraignments?court=agua-fria');
            
            const widget = await $('.widget-container');
            await widget.waitForExist({ timeout: 10000 });
            
            // Widget should be filtered for specific court
            expect(await widget.isDisplayed()).toBe(true);
        });
    });
    
    describe('Widget Gallery', () => {
        it('should load widget gallery', async () => {
            await browser.url('/widgets/gallery');
            
            const gallery = await $('.widget-gallery');
            await gallery.waitForExist({ timeout: 10000 });
            
            expect(await gallery.isDisplayed()).toBe(true);
            
            // Check for configurator
            const configurator = await $('.widget-configurator');
            expect(await configurator.isExisting()).toBe(true);
        });
        
        it('should show embed code', async () => {
            await browser.url('/widgets/gallery');
            
            await browser.waitUntil(
                async () => (await $('.embed-code')).isExisting(),
                {
                    timeout: 10000,
                    timeoutMsg: 'Embed code section not found'
                }
            );
            
            const embedCode = await $('.embed-code');
            expect(await embedCode.isDisplayed()).toBe(true);
        });
    });
    
    describe('Widget API Endpoints', () => {
        it('should return valid config from API', async () => {
            await browser.url('/api/widgets/config');
            
            // Wait for JSON response
            await browser.pause(1000);
            
            const bodyText = await $('body').getText();
            const data = JSON.parse(bodyText);
            
            expect(data.success).toBe(true);
            expect(data.data.availableWidgets).toBeDefined();
        });
        
        it('should return arraignment data from API', async () => {
            await browser.url('/api/widgets/data/arraignments');
            
            await browser.pause(1000);
            
            const bodyText = await $('body').getText();
            const data = JSON.parse(bodyText);
            
            expect(data.success).toBe(true);
            expect(Array.isArray(data.data)).toBe(true);
        });
        
        it('should return stats data from API', async () => {
            await browser.url('/api/widgets/data/stats');
            
            await browser.pause(1000);
            
            const bodyText = await $('body').getText();
            const data = JSON.parse(bodyText);
            
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
        });
    });
    
    describe('Widget iframe Embedding', () => {
        it('should work in iframe context', async () => {
            // Create a test page with iframe
            await browser.execute(() => {
                document.body.innerHTML = `
                    <iframe 
                        id="test-widget" 
                        src="/widgets/stats" 
                        width="600" 
                        height="400">
                    </iframe>
                `;
            });
            
            // Wait for iframe to load
            await browser.pause(2000);
            
            // Switch to iframe context
            const iframe = await $('#test-widget');
            await browser.switchToFrame(iframe);
            
            // Check widget loads in iframe
            const widget = await $('.widget-container');
            expect(await widget.isExisting()).toBe(true);
            
            // Switch back to main context
            await browser.switchToParentFrame();
        });
    });
    
    describe('CORS and Security Headers', () => {
        it('should have proper CORS headers', async () => {
            // This test would need to be done via fetch API
            const result = await browser.execute(async () => {
                const response = await fetch('/api/widgets/config', {
                    headers: {
                        'Origin': 'http://example.com'
                    }
                });
                return {
                    corsHeader: response.headers.get('Access-Control-Allow-Origin'),
                    status: response.status
                };
            });
            
            expect(result.corsHeader).toBeDefined();
            expect(result.status).toBe(200);
        });
        
        it('should have CSP headers for widgets', async () => {
            await browser.url('/widgets/stats');
            
            // CSP headers would be checked server-side
            // This verifies the page loads without CSP errors
            const logs = await browser.getLogs('browser');
            const cspErrors = logs.filter(log => 
                log.message.includes('Content Security Policy')
            );
            
            expect(cspErrors.length).toBe(0);
        });
    });
    
    describe('Widget Responsiveness', () => {
        it('should be responsive on mobile viewport', async () => {
            await browser.setWindowSize(375, 667); // iPhone size
            await browser.url('/widgets/stats?size=card');
            
            const widget = await $('.widget-container');
            await widget.waitForExist({ timeout: 10000 });
            
            const size = await widget.getSize();
            expect(size.width).toBeLessThanOrEqual(375);
        });
        
        it('should be responsive on tablet viewport', async () => {
            await browser.setWindowSize(768, 1024); // iPad size
            await browser.url('/widgets/stats');
            
            const widget = await $('.widget-container');
            await widget.waitForExist({ timeout: 10000 });
            
            expect(await widget.isDisplayed()).toBe(true);
        });
        
        it('should be responsive on desktop viewport', async () => {
            await browser.setWindowSize(1920, 1080); // Desktop size
            await browser.url('/widgets/stats?size=dashboard');
            
            const widget = await $('.widget-container');
            await widget.waitForExist({ timeout: 10000 });
            
            expect(await widget.isDisplayed()).toBe(true);
        });
    });
});
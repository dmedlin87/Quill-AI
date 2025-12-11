// Debug script to understand the API configuration test failure
import { isAnyApiKeyConfigured, getApiKey, resetWarningState, resetQuotaState } from './config/api.ts';

// Simulate test environment
delete process.env.API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.VITE_GEMINI_API_KEY;
delete process.env.TEST_API_KEY_OVERRIDE;

globalThis.import = { meta: { env: {} } };

// Mock localStorage
const mockGetItem = () => null;
Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: mockGetItem },
    writable: true,
    configurable: true
});

resetWarningState();
resetQuotaState();

console.log('Environment variables:');
console.log('  API_KEY:', process.env.API_KEY);
console.log('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY);
console.log('  VITE_GEMINI_API_KEY:', process.env.VITE_GEMINI_API_KEY);
console.log('  TEST_API_KEY_OVERRIDE:', process.env.TEST_API_KEY_OVERRIDE);
console.log('\nlocalStorage.getItem() result:', globalThis.localStorage.getItem('quill-settings'));
console.log('\ngetApiKey():', JSON.stringify(getApiKey()));
console.log('isAnyApiKeyConfigured():', isAnyApiKeyConfigured());
console.log('\nExpected: false');
console.log('Test should', isAnyApiKeyConfigured() === false ? 'PASS' : 'FAIL');

/**
 * Security Configuration
 *
 * Centralized security constants and policies.
 */

// 10MB limit to prevent browser crash/DoS during client-side file reading
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

// Allowed file extensions for manuscript import
export const ALLOWED_FILE_EXTENSIONS = ['.txt', '.md', '.docx'];

// Allowed MIME types (browser detection can be flaky, so we rely mainly on extensions + parsing)
export const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

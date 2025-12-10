import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('index.html', () => {
  const htmlContent = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');

  it('should not have duplicate closing style tags', () => {
    // Regex to find lines with multiple </style> tags
    const duplicateStyleTagPattern = /<\/style>.*<\/style>/;
    expect(htmlContent).not.toMatch(duplicateStyleTagPattern);
  });

  it('should have balanced style tags', () => {
    const openingTags = (htmlContent.match(/<style[^>]*>/g) || []).length;
    const closingTags = (htmlContent.match(/<\/style>/g) || []).length;
    expect(openingTags).toBe(closingTags);
  });

  it('should be valid HTML structure with proper head closing', () => {
    // Ensure </head> comes after all style and script tags in head
    const headCloseIndex = htmlContent.indexOf('</head>');
    const lastStyleClose = htmlContent.lastIndexOf('</style>');
    const importMapClose = htmlContent.indexOf('</script>', htmlContent.indexOf('importmap'));
    
    expect(headCloseIndex).toBeGreaterThan(lastStyleClose);
    expect(headCloseIndex).toBeGreaterThan(importMapClose);
  });
});

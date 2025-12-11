## 2024-05-23 - Client-Side DoS via File Upload
**Vulnerability:** The `FileUpload` component read entire files into memory using `file.text()` without checking `file.size` first.
**Learning:** In client-side apps, "self-DoS" is still a UX issue. Browsers will crash if you try to read 500MB into a string.
**Prevention:** Always check `file.size` against a reasonable limit (e.g., 10MB) before reading content, even in client-side only apps.

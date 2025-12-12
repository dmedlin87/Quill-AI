export async function extractRawTextFromDocxArrayBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const mod: any = await import('mammoth');
    const mammoth = mod?.default ?? mod;
    const result = await mammoth.extractRawText({ arrayBuffer });

    return String(result?.value ?? '').replace(/\r\n?/g, '\n');
  } catch (error) {
    console.error('[docxImporter] Failed to extract text from .docx', error);
    throw new Error('Failed to extract text from .docx');
  }
}

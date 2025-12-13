import React, { useCallback, useState } from 'react';
import { RecentFile } from '@/types';
import { extractRawTextFromDocxArrayBuffer } from '@/services/io/docxImporter';
import { MAX_UPLOAD_SIZE } from '@/config/security';

interface FileUploadProps {
  onTextLoaded: (text: string, fileName: string) => void;
  recentFiles?: RecentFile[];
}

export const FileUpload: React.FC<FileUploadProps> = ({ onTextLoaded, recentFiles = [] }) => {
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    if (!file) return;

    try {
      // Security Check: Size Limit
      if (file.size > MAX_UPLOAD_SIZE) {
        setError(`File too large. Max size is ${MAX_UPLOAD_SIZE / 1024 / 1024}MB.`);
        event.target.value = '';
        return;
      }

      if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        const text = await file.text();
        onTextLoaded(text, file.name);
        event.target.value = '';
        return;
      }

      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const text = await extractRawTextFromDocxArrayBuffer(arrayBuffer);
        onTextLoaded(text, file.name);
        event.target.value = '';
        return;
      }

      setError("Unsupported file format. Please upload .txt, .md, or .docx.");
      event.target.value = '';
    } catch (e) {
      setError("Could not read file. Please ensure it is a valid text document.");
      console.error('File read error:', e);
      event.target.value = '';
    }
  }, [onTextLoaded]);

  return (
    <div className="w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transition-all hover:shadow-2xl">
      <div className="p-8 flex flex-col gap-8">
        
        {/* Header */}
        <div className="text-center">
            <h3 className="text-2xl font-serif font-bold text-gray-900">Upload Manuscript</h3>
            <p className="text-gray-500 mt-2 text-sm">Supported formats: .txt, .md, .docx (Max 10MB)</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600 animate-in fade-in slide-in-from-top-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Upload Box */}
        <label className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-gray-50 transition-all duration-200 group bg-gray-50/50`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <div className="w-12 h-12 mb-3 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                </div>
                <p className="mb-1 text-sm text-gray-700 font-medium">Click to upload draft</p>
                <p className="text-xs text-gray-400">TXT, MD, DOCX (Max 10MB)</p>
            </div>
            <input 
                type="file" 
                className="hidden" 
                accept=".txt,.md,.docx" 
                onChange={handleFileChange} 
            />
        </label>

        {/* Divider */}
        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 uppercase tracking-widest text-[10px] font-semibold">Or Paste Text</span>
            </div>
        </div>

        {/* Text Area */}
        <div className="relative">
            <textarea 
              className="w-full h-32 p-4 text-sm text-gray-700 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none bg-gray-50 transition-all placeholder:text-gray-400 shadow-inner"
              placeholder="Paste text here..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <button
                type="button"
                disabled={!pastedText.trim()}
                onClick={() => onTextLoaded(pastedText, 'Untitled Draft')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
              >
                Load pasted text
              </button>
            </div>
        </div>

        {/* Recent Files */}
        {recentFiles.length > 0 && (
            <div className="border-t border-gray-100 pt-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Recent Drafts</h4>
                <div className="space-y-2">
                    {recentFiles.map((file, idx) => (
                        <button 
                            key={`${file.name}-${idx}`}
                            onClick={() => onTextLoaded(file.content, file.name)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group text-left"
                        >
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h5 className="text-sm font-semibold text-gray-800 truncate group-hover:text-indigo-600 transition-colors">{file.name}</h5>
                                <p className="text-xs text-gray-400">Edited {new Date(file.timestamp).toLocaleDateString()}</p>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
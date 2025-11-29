import React, { useRef, useEffect, useCallback } from 'react';
import { useVoiceSession } from '../hooks/useVoiceSession';

/**
 * VoiceMode Component
 * 
 * Real-time voice conversation with Gemini Live API.
 * All audio logic extracted to useVoiceSession hook.
 */
export const VoiceMode: React.FC = () => {
  const { 
    isConnected, 
    isAiSpeaking, 
    error,
    startSession, 
    stopSession,
    inputAnalyserRef,
    outputAnalyserRef 
  } = useVoiceSession();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Visualizer - renders audio frequency data to canvas
  // ─────────────────────────────────────────────────────────────────────────────
  const renderVisualizer = useCallback(() => {
    if (!canvasRef.current || !inputAnalyserRef.current || !outputAnalyserRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Get Frequency Data
    const inputFreq = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
    inputAnalyserRef.current.getByteFrequencyData(inputFreq);
    
    const outputFreq = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
    outputAnalyserRef.current.getByteFrequencyData(outputFreq);

    // Determine who is speaking
    const getAvg = (arr: Uint8Array) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const outputVol = getAvg(outputFreq);
    const aiActive = outputVol > 10;

    const activeData = aiActive ? outputFreq : inputFreq;
    const activeColor = aiActive ? '#22d3ee' : '#6366f1'; // Cyan vs Indigo
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw Bars
    const barCount = 32;
    const barWidth = 6;
    const gap = 4;
    const totalWidth = barCount * (barWidth + gap);
    const startX = (width - totalWidth) / 2;
    const centerY = height / 2;

    ctx.fillStyle = activeColor;
    const step = Math.floor(activeData.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = activeData[i * step];
      const percent = value / 255;
      const barHeight = Math.max(4, percent * height * 0.8);
      
      const x = startX + i * (barWidth + gap);
      const y = centerY - barHeight / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 4);
      ctx.fill();
      
      ctx.shadowBlur = 10;
      ctx.shadowColor = activeColor;
    }
    ctx.shadowBlur = 0;

    animationFrameRef.current = requestAnimationFrame(renderVisualizer);
  }, [inputAnalyserRef, outputAnalyserRef]);

  // Start/stop visualizer based on connection state
  useEffect(() => {
    if (isConnected) {
      renderVisualizer();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isConnected, renderVisualizer]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl relative overflow-hidden">
      
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-600 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-600 rounded-full blur-3xl"></div>
      </div>

      <div className="z-10 flex flex-col items-center w-full max-w-md">
        
        {/* Visualizer Canvas */}
        <div className="relative w-full h-48 flex items-center justify-center mb-6">
            {!isConnected ? (
                 <div className="w-32 h-32 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/30">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-indigo-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                     </svg>
                 </div>
            ) : (
                <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={200} 
                    className="w-full h-full"
                />
            )}
        </div>

        <h3 className="text-3xl font-serif font-bold tracking-tight mb-2">
            {isConnected ? (isAiSpeaking ? "Gemini is speaking..." : "Listening...") : "Start Voice Session"}
        </h3>
        
        <p className="text-slate-300 text-center mb-10 h-10">
          {error 
            ? <span className="text-red-400">{error}</span>
            : isConnected 
              ? (isAiSpeaking ? "Listen to the critique..." : "Speak naturally to brainstorm ideas.") 
              : "Have a real-time conversation about your plot, characters, and pacing."}
        </p>

        <button
          onClick={isConnected ? stopSession : startSession}
          className={`group relative flex items-center justify-center px-8 py-4 rounded-full font-semibold text-lg transition-all transform hover:scale-105 ${
            isConnected 
              ? 'bg-red-500/90 hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
              : 'bg-white text-indigo-900 hover:bg-indigo-50 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
          }`}
        >
          {isConnected ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                End Session
              </>
          ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2 text-indigo-600 group-hover:scale-110 transition-transform">
                    <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                    <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
                </svg>
                Start Conversation
              </>
          )}
        </button>
      </div>
    </div>
  );
};

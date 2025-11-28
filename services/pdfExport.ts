import { jsPDF } from "jspdf";
import { AnalysisResult } from "../types";

export const generatePDF = (analysis: AnalysisResult, fileName: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Helper: Check page break
  const checkPageBreak = (height: number) => {
    if (cursorY + height > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
  };

  // Helper: Title
  const addTitle = (text: string, size: number = 24, isSerif = true) => {
    doc.setFont(isSerif ? "times" : "helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(30, 30, 70); // Dark Indigo
    doc.text(text, margin, cursorY);
    cursorY += size * 0.5; // Spacing
  };

  // Helper: Subtitle/Label
  const addSubtitle = (text: string, size: number = 14) => {
    checkPageBreak(size);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(79, 70, 229); // Indigo 600
    doc.text(text, margin, cursorY);
    cursorY += 8;
  };

  // Helper: Body Text
  const addBody = (text: string, fontSize: number = 11) => {
    doc.setFont("times", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(20, 20, 20);
    
    // Split text
    const lines = doc.splitTextToSize(text, contentWidth);
    const height = lines.length * (fontSize * 0.45); // Line height approx
    
    checkPageBreak(height);
    doc.text(lines, margin, cursorY);
    cursorY += height + 6;
  };

  // Helper: Divider
  const addDivider = () => {
    checkPageBreak(10);
    cursorY += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 8;
  };

  // --- COVER PAGE ---
  cursorY = 60;
  doc.setFont("times", "bold");
  doc.setFontSize(32);
  doc.setTextColor(30, 30, 70);
  doc.text("DraftSmith Literary Report", pageWidth / 2, cursorY, { align: "center" });
  
  cursorY += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(`Analysis for: ${fileName}`, pageWidth / 2, cursorY, { align: "center" });
  
  cursorY += 10;
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(dateStr, pageWidth / 2, cursorY, { align: "center" });

  cursorY += 40;
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 40, cursorY, pageWidth / 2 + 40, cursorY);

  // --- EXECUTIVE SUMMARY ---
  doc.addPage();
  cursorY = margin;
  addTitle("Executive Summary");
  cursorY += 10;
  addBody(analysis.summary, 12);
  
  cursorY += 10;
  
  // Strengths
  addSubtitle("Key Strengths");
  if (analysis.strengths) {
    analysis.strengths.forEach(s => {
       checkPageBreak(10);
       doc.setFont("times", "normal");
       doc.setFontSize(11);
       doc.setTextColor(22, 163, 74); // Green
       doc.text("•", margin, cursorY);
       doc.setTextColor(20, 20, 20);
       doc.text(doc.splitTextToSize(s, contentWidth - 5), margin + 5, cursorY);
       cursorY += 7;
    });
  }
  cursorY += 5;

  // Weaknesses
  addSubtitle("Areas for Improvement");
  if (analysis.weaknesses) {
    analysis.weaknesses.forEach(w => {
       checkPageBreak(10);
       doc.setFont("times", "normal");
       doc.setFontSize(11);
       doc.setTextColor(220, 38, 38); // Red
       doc.text("•", margin, cursorY);
       doc.setTextColor(20, 20, 20);
       doc.text(doc.splitTextToSize(w, contentWidth - 5), margin + 5, cursorY);
       cursorY += 7;
    });
  }

  // --- PACING ---
  doc.addPage();
  cursorY = margin;
  addTitle("Pacing & Narrative Flow");
  cursorY += 10;
  
  addSubtitle(`Pacing Score: ${analysis.pacing.score}/10`);
  addBody(analysis.pacing.analysis);

  if (analysis.pacing.slowSections.length > 0) {
      addSubtitle("Dragging Sections (Slow)", 12);
      analysis.pacing.slowSections.forEach(s => addBody(`• ${s}`));
  }
  
  if (analysis.pacing.fastSections.length > 0) {
      addSubtitle("Rushed Sections (Fast)", 12);
      analysis.pacing.fastSections.forEach(s => addBody(`• ${s}`));
  }

  // --- CHARACTERS ---
  doc.addPage();
  cursorY = margin;
  addTitle("Character Development");
  cursorY += 5;

  analysis.characters.forEach((char) => {
     checkPageBreak(60); // Ensure we don't start a char at very bottom
     
     // Box for character
     doc.setFillColor(248, 250, 252); // Slate 50
     doc.setDrawColor(226, 232, 240); // Slate 200
     doc.rect(margin - 2, cursorY - 5, contentWidth + 4, 12, 'F');
     
     doc.setFont("times", "bold");
     doc.setFontSize(16);
     doc.setTextColor(30, 30, 70);
     doc.text(char.name, margin, cursorY + 3);
     cursorY += 15;

     addBody(`Bio: ${char.bio}`);
     addBody(`Arc: ${char.arc}`);
     
     if (char.developmentSuggestion) {
         doc.setFont("helvetica", "italic");
         doc.setFontSize(10);
         doc.setTextColor(79, 70, 229);
         const lines = doc.splitTextToSize(`Suggestion: ${char.developmentSuggestion}`, contentWidth);
         checkPageBreak(lines.length * 5);
         doc.text(lines, margin, cursorY);
         cursorY += (lines.length * 5) + 10;
     } else {
         cursorY += 5;
     }
     
     addDivider();
  });

  // --- PLOT ISSUES ---
  if (analysis.plotIssues.length > 0) {
      doc.addPage();
      cursorY = margin;
      addTitle("Plot Analysis");
      cursorY += 10;

      analysis.plotIssues.forEach(issue => {
          checkPageBreak(30);
          addSubtitle(issue.issue, 12);
          addBody(`Location: ${issue.location}`);
          addBody(`Fix Suggestion: ${issue.suggestion}`);
          cursorY += 5;
      });
  }

  // Save
  doc.save(`DraftSmith_Report_${fileName.replace(/\.[^/.]+$/, "")}.pdf`);
};

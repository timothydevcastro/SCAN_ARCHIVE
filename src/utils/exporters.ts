import { jsPDF } from 'jspdf';
import { ScanData, HistoryItem } from '../types/scan';

export const exportToPdf = (scan: ScanData) => {
  if (!scan) return;

  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();

  // Branding
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text('TRDC // OFFICIAL_ARCHIVE_DATA', 10, 15);
  doc.setFontSize(18);
  doc.text('SCAN_ARCHIVE_LOG_V1.0', 10, 24);
  
  doc.setFontSize(10);
  doc.text(`EXTRACT_TIMESTAMP: ${timestamp}`, 10, 32);
  doc.line(10, 36, 200, 36);

  // Subject Header
  doc.setFontSize(24);
  doc.text(scan.objectName || 'UNKNOWN_SUBJECT', 10, 45);
  
  doc.setFontSize(10);
  doc.text(`SUBJECT_ID: ${scan.subjectId || 'N/A'}`, 10, 52);
  doc.text(`CONFIDENCE: ${scan.confidence || 'N/A'}`, 10, 57);

  // Classification
  doc.setFont('courier', 'bold');
  doc.text('CLASSIFICATION:', 10, 70);
  doc.setFont('courier', 'normal');
  const splitClassification = doc.splitTextToSize(scan.classification || 'No classification available.', 180);
  doc.text(splitClassification, 10, 77);

  // Facts
  let yPos = 77 + (splitClassification.length * 5) + 10;
  doc.setFont('courier', 'bold');
  doc.text('ARCHIVAL_FACTS:', 10, yPos);
  yPos += 7;
  
  doc.setFont('courier', 'normal');
  scan.facts?.forEach((fact, i) => {
    const splitFact = doc.splitTextToSize(`FACT_0${i + 1}: ${fact}`, 175);
    doc.text(splitFact, 15, yPos);
    yPos += (splitFact.length * 5) + 2;
  });

  // Footer
  doc.setFontSize(8);
  doc.text('--- END OF DATA RECORD ---', 105, 285, { align: 'center' });

  doc.save(`${scan.objectName || 'scan'}_record.pdf`);
};

export const exportHistoryToJson = (history: HistoryItem[]) => {
  const dataStr = JSON.stringify(history, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `scan_archive_full_log_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

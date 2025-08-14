import { jsPDF } from 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: {
      head?: any[][];
      body?: any[][];
      startY?: number;
      styles?: any;
      columnStyles?: any;
      headStyles?: any;
      bodyStyles?: any;
      alternateRowStyles?: any;
      margin?: any;
      theme?: string;
    }) => jsPDF;
  }
}

declare module 'jspdf-autotable';
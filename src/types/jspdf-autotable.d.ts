declare module 'jspdf-autotable' {
  interface AutoTableOptions {
    head?: any[][];
    body?: any[][];
    startY?: number;
    styles?: any;
    columnStyles?: any;
  }
}

declare namespace jsPDF {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}
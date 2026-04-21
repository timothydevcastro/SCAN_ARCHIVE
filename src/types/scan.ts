export interface RelatedScan {
  timestamp: string;
  objectName: string;
}

export interface ScanData {
  isVague: boolean;
  objectName?: string;
  confidence?: string;
  subjectId?: string;
  classification?: string;
  imagePrompt?: string;
  facts?: string[];
  relatedScans?: RelatedScan[];
  imageUrl?: string;
}

export interface HistoryItem {
  id: string;
  query: string;
  timestamp: string;
  data?: ScanData;
}

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';
export type WhyConfidence = 'confirmed' | 'inferred' | 'unknown';
export type ReviewAnnotationKind = 'intent' | 'mechanism' | 'risk';

export interface ReviewFile {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
}

export interface ReviewChange {
  id: string;
  path: string;
  status: FileStatus;
  patch?: string;
  note?: string;
  annotations?: ReviewAnnotation[];
}

export interface ReviewAnnotation {
  id: string;
  side: 'additions' | 'deletions';
  lineNumber: number;
  kind: ReviewAnnotationKind;
  title: string;
  body: string;
  confidence: WhyConfidence;
}

export interface ReviewPart {
  id: string;
  order: number;
  title: string;
  summary: string;
  whatChanged: string;
  whyThisApproach: string;
  whyConfidence: WhyConfidence;
  reviewFocus: string[];
  evidence: string[];
  dependsOn: string[];
  changes: ReviewChange[];
}

export interface ReviewData {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    repository: string;
    number: number;
    url: string;
    baseRef: string;
    headRef: string;
    headCommit: string;
  };
  pr: {
    title: string;
    author: string;
    description: string;
  };
  summary: {
    overview: string;
    reviewStrategy: string;
    risk: string;
  };
  files: ReviewFile[];
  parts: ReviewPart[];
}

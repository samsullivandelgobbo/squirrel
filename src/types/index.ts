// src/types.ts

export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface AcornConfig {
  utorid: string;
  password: string;
  bypassCodes: string[];
  cookies?: StoredCookie[];
  lastLogin?: string;
}

export interface CourseEnrollmentConfig {
  courseCode: string;
  sessionCode: string;
  sectionCode: string;
  tutorialSections?: string[];
  lectureSections?: string[];
  waitTime: number;
}

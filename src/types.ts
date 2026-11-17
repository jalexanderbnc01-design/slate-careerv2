export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  portfolioUrl: string;
  summary: string;
  skills: string[];
  software: string[];
  experience: {
    role: string;
    company: string;
    period: string;
    bullets: string[];
  }[];
  education: {
    degree: string;
    school: string;
    period: string;
    details?: string;
  }[];
  projects: {
    name: string;
    description: string;
    technologies: string[];
  }[];
  certifications: string[];
  languages?: string;
  workAuthorization?: string;
  targetJobTitles?: string;
  workSettingPreference?: "" | "Remote" | "Hybrid" | "On-site" | "Any";
  links?: string;
  projectNotes?: string;
}

export interface MatchDetails {
  strongMatches: string[];
  partialMatches: string[];
  missingItems: string[];
  keywordsToAdd: string[];
  portfolioSuggestions: string[];
  overallScore: number; // 0 to 100
}

export interface JobAnalysis {
  requiredSkills: string[];
  preferredSkills: string[];
  software: string[];
  yearsOfExperience: string;
  location: string;
  workSetup: 'Remote' | 'Hybrid' | 'On-site' | 'Unspecified';
  keywords: string[];
  redFlags: string[];
  bestResumeAngle: string;
  matchScore?: MatchDetails;
}

export interface ResumeSection<T> {
  title: string;
  content: T;
}

export interface ResumeData {
  name: string;
  contact: string;
  summary: string;
  skills: string[];
  software: string[];
  experience: {
    role: string;
    company: string;
    period: string;
    bullets: string[];
  }[];
  education: {
    degree: string;
    school: string;
    period: string;
    details?: string;
  }[];
  projects: {
    name: string;
    description: string;
    technologies: string[];
  }[];
  certifications: string[];
  portfolioUrl?: string;
}

export interface CoverLetterData {
  date: string;
  companyName: string;
  jobTitle: string;
  recipientName: string;
  bodyParagraphs: string[];
  closing: string;
  signoff: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  isCustom?: boolean;
}

export interface ApplicationPacket {
  id: string;
  jobTitle: string;
  companyName: string;
  jobLocation: string;
  jobPostingRaw: string;
  resumeStyle: string;
  tone: string;
  analysis?: JobAnalysis;
  resume?: ResumeData;
  coverLetter?: CoverLetterData;
  steps?: ChecklistItem[];
  notes?: string;
  createdAt: string;
}

export interface JobScores {
  money: number;
  creative: number;
  thcRisk: number;
  stress: number;
  skill: number;
  future: number;
}

export interface JobFixture {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  experienceLevel: string;
  skills: string[];
  summary: string;
  description: string;
  lane: string;
  scores: JobScores;
  latitude?: number;
  longitude?: number;
  remoteType?: "onsite" | "hybrid" | "remote";
  applyUrl?: string;
  source?: string;
  postedAt?: string;
  computedTotal?: number;
  computedScores?: JobScores;
}

export interface TrackerRow {
  id: string;
  companyName: string;
  jobTitle: string;
  lane: string;
  pay: string;
  thcRisk: string;
  score: number;
  applied: boolean;
  followUpDate: string;
  notes: string;
  resumeVersion?: string;
  portfolioPiece?: string;
  contactName?: string;
  riskWarning?: string;
  nextAction?: string;
  interviewPrep?: string;
  companyTarget?: string;
  appliedDate?: string; // e.g. YYYY-MM-DD
  status?: "Draft" | "Applied" | "Silent rejection" | "Auto-rejection" | "Phone screen" | "Interview" | "Offer" | "Rejected after interview" | "Withdrew";
}

export interface WeeklyTask {
  id: string;
  day: string;
  title: string;
  details: string;
  completed: boolean;
}


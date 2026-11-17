export type CareerPathPriority = "High" | "Medium" | "Long-term";

export type XelimeApplicationStatus =
  | "Discovered"
  | "Researching"
  | "Qualified"
  | "Preparing Application"
  | "Applied"
  | "Interviewing"
  | "Offer Received"
  | "Rejected"
  | "Archived";

export type SkillCategory =
  | "Architecture"
  | "3D Design"
  | "Real-Time"
  | "Development"
  | "Product Design";

export type SkillDevStatus =
  | "Not Started"
  | "Learning"
  | "Practicing"
  | "Portfolio Ready"
  | "Professional";

export type ProjectDivision = "Architecture" | "Digital" | "Visualization";

export type ProjectProgressStatus = "Planned" | "In Progress" | "Review" | "Completed";

export type PortfolioPublishStatus = "Internal Draft" | "Portfolio Ready" | "Published";

export type FreelanceServiceCategory =
  | "CAD drafting"
  | "Architectural modeling"
  | "3D visualization"
  | "Interactive 3D websites"
  | "Digital interface design";

export type FreelanceStage =
  | "Lead"
  | "Estimate Sent"
  | "Contract Signed"
  | "Active Project"
  | "Invoiced"
  | "Paid";

export interface CareerMilestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface XelimeCareerPath {
  id: string;
  name: string;
  priority: CareerPathPriority;
  currentLevel: string;
  targetLevel: string;
  requiredSkills: string[];
  softwareRequirements: string[];
  potentialEmployers: string[];
  salaryExpectations: string;
  portfolioRequirements: string[];
  certificationsOrEducation: string[];
  milestones: CareerMilestone[];
}

export interface DecisionEngineScores {
  skillAlignment: number;       // 30%
  xelimeRelevance: number;      // 25%
  incomePotential: number;      // 20%
  workFlexibility: number;      // 15%
  professionalDevelopment: number; // 10%
}

export interface XelimeOpportunity {
  id: string;
  jobTitle: string;
  company: string;
  careerPathId: string;
  employmentType: "Full-time" | "Part-time" | "Contract" | "Freelance";
  workArrangement: "Remote" | "Hybrid" | "On-site";
  salary: number;
  salaryLabel?: string;
  location: string;
  applicationStatus: XelimeApplicationStatus;
  requiredSkills: string[];
  portfolioMatchIds: string[];
  applicationUrl: string;
  priority: "High" | "Medium" | "Low";
  dateApplied: string;
  notes?: string;
  decisionScores: DecisionEngineScores;
}

export interface XelimeSkill {
  id: string;
  name: string;
  category: SkillCategory;
  status: SkillDevStatus;
  currentProficiency: number; // 0-100
  targetProficiency: number;  // 0-100
  learningResources: string;
  practiceProjects: string;
  relatedCareerPathIds: string[];
}

export interface XelimeProject {
  id: string;
  name: string;
  division: ProjectDivision;
  careerPathIds: string[];
  software: string[];
  projectStatus: ProjectProgressStatus;
  skillsDemonstrated: string[];
  portfolioStatus: PortfolioPublishStatus;
  projectUrl: string;
  summary?: string;
}

export interface XelimeFreelanceDeal {
  id: string;
  clientName: string;
  projectTitle: string;
  serviceCategory: FreelanceServiceCategory;
  stage: FreelanceStage;
  estimateAmount: number;
  contractSigned: boolean;
  deliverables: string;
  invoiceStatus: "Not Billed" | "Sent" | "Paid";
  revenueCollected: number;
  clientFeedback: string;
}

export interface XelimePhaseItem {
  phase: number;
  title: string;
  priority: "Immediate" | "Next" | "Later";
  completed: boolean;
  notes: string;
}

export interface XelimeWeeklyReview {
  lastReviewedDate: string;
  topOpportunityNote: string;
  keySkillGapNote: string;
  nextPortfolioMilestone: string;
  weeklyChecklist: { id: string; label: string; done: boolean }[];
}

export interface XelimeWorkspaceState {
  careerPaths: XelimeCareerPath[];
  opportunities: XelimeOpportunity[];
  skills: XelimeSkill[];
  projects: XelimeProject[];
  freelanceDeals: XelimeFreelanceDeal[];
  phases: XelimePhaseItem[];
  weeklyReview: XelimeWeeklyReview;
}

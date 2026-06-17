export interface AdminUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface Social {
  platform: string;
  url: string;
}

export interface Education {
  _id?: string;
  level: string;
  course: string;
  institution: string;
  startYear: string;
  endYear: string;
  details: string;
}

export interface Profile {
  fullName: string;
  headline: string;
  aboutMe: string;
  imageUrl: string;
  location: string;
  contactEmail: string;
  socials: Social[];
  education: Education[];
  resumeNote: string;
}

export interface Skill {
  _id: string;
  name: string;
  category: string;
  level: number;
  icon: string;
  order: number;
}

export type ProjectType = "enterprise" | "personal" | "archive";

export interface ProjectAsset {
  _id: string;
  type: "pdf" | "recording";
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface Project {
  _id: string;
  title: string;
  slug: string;
  type: ProjectType;
  summary: string;
  about: string;
  impact: string;
  learning: string;
  skillsUsed: string[];
  demoLink: string;
  githubLink: string;
  coverImage: string;
  assets: ProjectAsset[];
  featured: boolean;
  order: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ResumeRole = "SDE" | "AI" | "other";

export interface Resume {
  _id: string;
  title: string;
  role: ResumeRole;
  source: "uploaded" | "generated";
  fileUrl: string;
  content: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Blog {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  tags: string[];
  published: boolean;
  publishedAt?: string;
  readingMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; type: string }[];
}

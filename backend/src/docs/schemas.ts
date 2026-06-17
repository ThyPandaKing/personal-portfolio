/** Reusable OpenAPI component schemas for the portfolio API. */
export const schemas = {
  Error: {
    type: "object",
    properties: {
      error: { type: "string", example: "Not found" },
      details: { type: "object", nullable: true },
    },
  },
  OkResponse: {
    type: "object",
    properties: { ok: { type: "boolean", example: true } },
  },

  AdminUser: {
    type: "object",
    properties: {
      id: { type: "string", example: "66f1a2b3c4d5e6f7a8b9c0d1" },
      email: { type: "string", format: "email", example: "you@gmail.com" },
      name: { type: "string", example: "Aditya Sharma" },
      picture: { type: "string", example: "https://lh3.googleusercontent.com/a/..." },
    },
  },
  AuthMeResponse: {
    type: "object",
    properties: { user: { allOf: [{ $ref: "#/components/schemas/AdminUser" }], nullable: true } },
  },
  GoogleLoginRequest: {
    type: "object",
    required: ["credential"],
    properties: {
      credential: {
        type: "string",
        description: "Google Identity Services ID token (JWT credential).",
      },
    },
  },

  Social: {
    type: "object",
    required: ["platform", "url"],
    properties: {
      platform: { type: "string", example: "github" },
      url: { type: "string", format: "uri", example: "https://github.com/you" },
    },
  },
  Education: {
    type: "object",
    properties: {
      _id: { type: "string" },
      level: { type: "string", example: "B.Tech" },
      course: { type: "string", example: "Computer Science" },
      institution: { type: "string", example: "IIT" },
      startYear: { type: "string", example: "2018" },
      endYear: { type: "string", example: "2022" },
      details: { type: "string" },
    },
  },
  Profile: {
    type: "object",
    properties: {
      fullName: { type: "string" },
      headline: { type: "string" },
      aboutMe: { type: "string", description: "Markdown." },
      imageUrl: { type: "string" },
      location: { type: "string" },
      contactEmail: { type: "string" },
      socials: { type: "array", items: { $ref: "#/components/schemas/Social" } },
      education: { type: "array", items: { $ref: "#/components/schemas/Education" } },
      resumeNote: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  Skill: {
    type: "object",
    properties: {
      _id: { type: "string" },
      name: { type: "string", example: "TypeScript" },
      category: { type: "string", example: "Languages" },
      level: { type: "integer", minimum: 0, maximum: 100, example: 85 },
      icon: { type: "string" },
      order: { type: "integer", example: 0 },
    },
  },
  SkillInput: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", example: "TypeScript" },
      category: { type: "string", default: "General" },
      level: { type: "integer", minimum: 0, maximum: 100, default: 70 },
      icon: { type: "string" },
      order: { type: "integer", default: 0 },
    },
  },

  ProjectAsset: {
    type: "object",
    properties: {
      _id: { type: "string" },
      type: { type: "string", enum: ["pdf", "recording"] },
      url: { type: "string" },
      name: { type: "string" },
      size: { type: "integer" },
      mimeType: { type: "string" },
    },
  },
  Project: {
    type: "object",
    properties: {
      _id: { type: "string" },
      title: { type: "string" },
      slug: { type: "string" },
      type: { type: "string", enum: ["enterprise", "personal", "archive"] },
      summary: { type: "string" },
      about: { type: "string", description: "Markdown." },
      impact: { type: "string", description: "Markdown." },
      learning: { type: "string", description: "Markdown." },
      skillsUsed: { type: "array", items: { type: "string" } },
      demoLink: { type: "string" },
      githubLink: { type: "string" },
      coverImage: { type: "string" },
      assets: { type: "array", items: { $ref: "#/components/schemas/ProjectAsset" } },
      featured: { type: "boolean" },
      order: { type: "integer" },
      published: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  ProjectInput: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string" },
      type: { type: "string", enum: ["enterprise", "personal", "archive"], default: "personal" },
      summary: { type: "string" },
      about: { type: "string" },
      impact: { type: "string" },
      learning: { type: "string" },
      skillsUsed: { type: "array", items: { type: "string" } },
      demoLink: { type: "string" },
      githubLink: { type: "string" },
      coverImage: { type: "string" },
      featured: { type: "boolean", default: false },
      order: { type: "integer", default: 0 },
      published: { type: "boolean", default: true },
    },
  },

  Blog: {
    type: "object",
    properties: {
      _id: { type: "string" },
      title: { type: "string" },
      slug: { type: "string" },
      excerpt: { type: "string" },
      content: { type: "string", description: "Markdown." },
      coverImage: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      published: { type: "boolean" },
      publishedAt: { type: "string", format: "date-time", nullable: true },
      readingMinutes: { type: "integer" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  BlogInput: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string" },
      excerpt: { type: "string" },
      content: { type: "string" },
      coverImage: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      published: { type: "boolean", default: false },
    },
  },

  Resume: {
    type: "object",
    properties: {
      _id: { type: "string" },
      title: { type: "string" },
      role: { type: "string", enum: ["SDE", "AI", "other"] },
      source: { type: "string", enum: ["uploaded", "generated"] },
      fileUrl: { type: "string" },
      content: { type: "string", description: "Markdown (for generated resumes)." },
      isPublic: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  ResumeInput: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string" },
      role: { type: "string", enum: ["SDE", "AI", "other"], default: "other" },
      source: { type: "string", enum: ["uploaded", "generated"], default: "uploaded" },
      content: { type: "string" },
      fileUrl: { type: "string" },
      isPublic: { type: "boolean", default: false },
    },
  },
  ResumeGenerateRequest: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string", example: "Backend SDE Resume" },
      role: { type: "string", enum: ["SDE", "AI", "other"], default: "SDE" },
      projectIds: { type: "array", items: { type: "string" } },
      skills: { type: "array", items: { type: "string" } },
      instructions: { type: "string", example: "Emphasize distributed systems; one page." },
    },
  },

  UploadResult: {
    type: "object",
    properties: {
      url: { type: "string" },
      name: { type: "string" },
      size: { type: "integer" },
      mimeType: { type: "string" },
    },
  },
  UrlResponse: {
    type: "object",
    properties: { url: { type: "string" } },
  },

  ChatMessage: {
    type: "object",
    required: ["role", "content"],
    properties: {
      role: { type: "string", enum: ["user", "assistant"] },
      content: { type: "string" },
    },
  },
  ChatRequest: {
    type: "object",
    required: ["message"],
    properties: {
      message: { type: "string", example: "Tell me about your enterprise projects." },
      history: { type: "array", items: { $ref: "#/components/schemas/ChatMessage" } },
    },
  },
  Source: {
    type: "object",
    properties: {
      title: { type: "string" },
      type: { type: "string", example: "project" },
    },
  },
  ChatReply: {
    type: "object",
    properties: {
      answer: { type: "string" },
      sources: { type: "array", items: { $ref: "#/components/schemas/Source" } },
    },
  },
  DocumentIngestRequest: {
    type: "object",
    required: ["title", "text"],
    properties: {
      title: { type: "string" },
      text: { type: "string" },
    },
  },
  IngestResponse: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      chunks: { type: "integer" },
      detail: { type: "object", nullable: true },
    },
  },
  RagStatus: {
    type: "object",
    properties: {
      indexed_chunks: { type: "integer" },
      collection: { type: "string" },
    },
  },
} as const;

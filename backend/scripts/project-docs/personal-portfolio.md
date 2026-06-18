## Overview
Personal Portfolio is a full-stack web application that presents an engineer's work to the public while giving the owner a private admin CMS to manage everything. It is structured as a monorepo of three independent services - a React frontend, a Node/Express backend, and a Python/FastAPI AI agent - backed by a single MongoDB Atlas database that simultaneously stores documents, uploaded files (via GridFS), and RAG vectors (via Atlas Vector Search).

## Problem / Motivation
Rather than a static one-page site, the goal was a living portfolio whose content (about, skills, education, projects, blogs, resumes) is fully editable by the owner without redeploying, and which lets visitors interactively explore that content through an AI chatbot. A secondary goal was an admin-only AI resume generator that assembles tailored resumes from selected projects and skills. The project also doubles as a demonstration of a realistic polyglot microservice architecture deployable entirely on free tiers.

## How it works / Architecture
The frontend is a React 18 + Vite + TypeScript SPA styled with Tailwind, using React Query for server state, React Router for routing, and Framer Motion for animation. It always calls relative /api/... paths, which resolve via a Vite dev proxy, an nginx proxy in Docker, or a Vercel rewrite in production - keeping the app single-origin so authentication cookies stay same-site. The backend is Express + Mongoose exposing CRUD routes for profile, projects, blogs, skills, resumes, files, uploads and users, with Swagger docs and a Vitest/Supertest suite. Authentication uses Google Identity Services: the backend verifies the Google ID token, checks the email against an admin allow-list, and issues a JWT session cookie. The AI service is FastAPI hosting a LangGraph ReAct agent with three tools - search_portfolio_docs (RAG), list_projects, and get_profile_summary - giving the agent live database access. RAG ingestion chunks projects (including extracted text from attached PDFs in GridFS), blogs, profile and skills, embeds them with Gemini, and upserts them into a MongoDB collection queried through the vector-search aggregation stage against an Atlas Vector Search index that is created idempotently on first ingest.

## Key features
Public site with editable home, projects (enterprise/personal/archive), blogs, and public resumes; a Google-OAuth admin CMS with full CRUD plus a re-index control; a grounded RAG chatbot that cites sources; and an AI resume generator that builds ATS-friendly Markdown resumes from selected projects, skills and free-form instructions.

## Tech stack
React, Vite, TypeScript, Tailwind, React Query, Framer Motion; Node, Express, Mongoose, Zod, JWT, google-auth-library, Multer, GridFS, PDFKit; Python, FastAPI, LangGraph, LangChain, langchain-google-genai (Gemini), pymongo, pypdf. MongoDB Atlas provides documents, files and vectors. Docker Compose for local single-origin runs; Vercel (frontend) and Render (backend + agent) for deployment, with GitHub Actions CI for typecheck, tests and build.

## Challenges
Keeping authentication cookies working across three runtime topologies drove the single-origin proxy/rewrite design. LLM reliability was addressed with a Gemini multi-model fallback chain (up to three attempts) that surfaces failure reasoning instead of crashing, while embeddings are deliberately pinned to one model so the vector space cannot be corrupted by mixing embedders.

## Outcome
The result is a coherent, well-documented portfolio platform with public browsing, an admin CMS, and two Gemini-powered AI features, engineered for resilient free-tier deployment.

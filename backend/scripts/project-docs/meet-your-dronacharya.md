## Overview
Meet your Dronacharya is a full-stack web application that acts as a single, community-driven hub for student career guidance. Named after the legendary mentor Dronacharya, the platform's premise is that students in India too often choose a degree before discovering what they actually want to do; the app aims to surface that interest earlier through community knowledge, expert experiences, and self-assessment tools. It was built by a four-person team as a substantial project (roughly 320 commits between September and December 2021).

## Problem / Motivation
The team observed that many students enter fields like engineering without genuine interest, simply because they lack exposure to career options. Existing Q&A sites (the README explicitly contrasts the app with Quora) are general-purpose. The goal was a focused, single platform combining doubt-asking, mentor experience sharing, study-material exchange, important-exam timelines, and a guided "find your interest" flow, all in one place.

## How it works / Architecture
The repository is a MERN monorepo with three package manifests: a root orchestrator, a client React app, and a server Express API. The root package uses concurrently to run the React dev server (port 3000) and the Node backend (port 3001) together. The Express server wires body-parser, CORS, and an HTTP server wrapped by Socket.io. It mounts feature routers under namespaced routes: ask-something/question, ask-something/answer, experience, study-material, dashboard, chatbox, and auth routes. Data is persisted in MongoDB Atlas through Mongoose models. Real-time chat uses Socket.io rooms keyed by a deterministic concatenation of the two participants' user IDs, with join/sendMessage/disconnect events broadcasting messages to the room.

## Key features
The platform includes: an "Ask Something" Q&A module with likes, sorting, editing, image uploads and a news API; an "Experience" section where experts share career journeys (plus a motivational-quote API); shareable study material with location tags; a "Find Myself" career-fit questionnaire that scores and ranks career options; an exam Timeline with calendar and bookmarks; user dashboards with follow/unfollow and social links; and one-to-one real-time chat. Two NLP-flavored features stand out: "Guruji," a chatbot built from scratch using tokenization and stemming, and automated spam detection on submitted posts.

## Tech stack
Frontend: React 17 with react-router, Material-UI v4 and MUI v5, Emotion styling, TinyMCE rich-text editor, react-quill, axios, react-toastify, react-google-charts, DOMPurify, and socket.io-client. Backend: Node.js, Express, Mongoose 6, Socket.io 4, bcrypt for password hashing, Nodemailer for OTP-based password recovery, Multer for uploads, and the akismet-api client for spam checking. Authentication supports both email/password (bcrypt-hashed) and Google sign-in.

## Challenges
The team implemented several non-trivial integrations: deterministic Socket.io room management for private chat, an OTP email-reset flow with Nodemailer, third-party spam classification via Akismet, and a hand-rolled NLP chatbot. As a learning project, some choices reflect that scope, such as a hardcoded MongoDB connection string and email credentials in source, and OTP/auth state held in memory rather than tokenized sessions.

## Outcome
The result is a feature-complete, deployed (Netlify) demonstration of an end-to-end MERN application spanning authentication, multiple CRUD-backed content modules, real-time messaging, and lightweight NLP. It successfully showcases the breadth of skills a student team can integrate, while remaining an academic-grade build rather than a production-hardened service.

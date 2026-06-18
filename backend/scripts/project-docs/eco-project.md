## Overview
Eco Project (eco-project-back) is the server-side component of an ecology-focused blogging application. It is a lightweight RESTful API written in JavaScript on Node.js, using the Express web framework and Mongoose as the MongoDB object-data-modeling layer. The API lets clients create and manage blog posts about environmental topics, as well as register basic users.

## Problem / Motivation
The project addresses the need for a backend to store and serve ecology-related blog content. Rather than a static site, it provides a persistent data store and HTTP endpoints so that a separate frontend client could create, read, update, and delete blog entries. The structure and naming (and the leftover "exercise" comments in the code) strongly suggest this was built as a learning exercise following the common MERN-stack tutorial pattern, adapted to an environmental blogging theme.

## How it works / Architecture
The entry point, index.js, bootstraps an Express application, loads environment variables via dotenv, and enables CORS and JSON body parsing as middleware. It connects to a MongoDB Atlas cluster using a connection string supplied through the ATLAS_URI environment variable and the Mongoose connect API. Two route modules are mounted: /blogs and /users. Each route module imports a corresponding Mongoose model defined in the models directory. The server listens on the PORT environment variable or defaults to 5000.

## Key features
The /blogs router implements full CRUD: GET / returns all blogs, POST /add creates a new blog from request-body fields, GET /:id fetches a single blog by its MongoDB id, DELETE /:id removes a blog, and POST /update/:id updates a blog while preserving existing values for any fields not supplied. The /users router supports GET / to list users and POST /add to create a user. Blog documents capture username, heading, description, optional image link and citation, and a required date, while user documents store a unique, trimmed username with a minimum length of three characters. Both schemas enable Mongoose timestamps for automatic createdAt/updatedAt tracking.

## Tech stack
The application is built on Node.js with Express 4 as the HTTP framework and Mongoose 5 for MongoDB modeling against a MongoDB Atlas database. Supporting libraries include cors for cross-origin access, dotenv for configuration, and nodemon (via the npm start script) for development-time auto-reloading.

## Notable implementation details / challenges
The update endpoint uses a fetch-then-modify pattern with ternary fallbacks so that partial updates do not overwrite existing fields with undefined values, and it parses incoming date strings with Date.parse. Error handling is consistent across endpoints, returning HTTP 400 with the error message on failure. Configuration is externalized through environment variables, keeping the database credentials out of source control.

## Outcome
The result is a functional, cleanly organized CRUD backend suitable for pairing with a frontend (the companion "front" repo implied by the "-back" naming). As a backend for an ecology project authored over roughly two months in late 2020, it is best characterized as a solid student/learning project that demonstrates competent use of the Express + Mongoose + MongoDB Atlas stack rather than a production-hardened service.

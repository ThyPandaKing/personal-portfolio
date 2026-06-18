## Overview
KBC Tirutsava is a full-stack web application that recreates the popular Indian television quiz show "Kaun Banega Crorepati" (the Indian adaptation of "Who Wants to Be a Millionaire") so it can be run as a live event at the Tirutsava college festival. The README explicitly frames it as a tool for event coordinators, who run the website on a quiz master's machine and mirror the screen to the participant and audience via a projector and a video call such as Google Meet or Zoom.

## Problem / Motivation
Running a polished KBC-style game live at a fest requires a question bank, a prize ladder, a countdown timer, and the show's signature lifelines. Rather than improvise this manually, the project provides a purpose-built website that the quiz master controls, with a separate interface for organizers to load and reset questions before and between rounds.

## How it works / Architecture
The system is split into two parts inside one repository. The frontend (kbc-quiz) is a Create React App project using React 17 and React Router for three routes: a Home landing page, a MainQuiz game screen, and an AddQuestions admin screen. The backend (server) is an Express server that connects to MongoDB Atlas through Mongoose and exposes REST endpoints. The frontend talks to it over Axios. Endpoints include GET /question (list all), POST /find (fetch unused questions for a level), POST /add-question, PUT /update-level (mark a question used), and PUT /reset-all (mark every question unused again). A Mongoose question schema stores the question text, level, four options, the correct option index, and a used flag; a user schema also exists for participant data.

## Key features
The MainQuiz component manages the entire game in React state. It presents a 13-rung prize ladder, lets the operator set two checkpoints below which winnings are protected, and applies per-level timers (30 seconds before the first checkpoint, 45 after, and unlimited beyond the second). Each question is selected at random from the unused pool for the current level. All four canonical lifelines are implemented: 50/50 (blanks two wrong options based on the correct answer), Flip the Question (swaps in another unused question and marks the current one used in the DB), Expert Advice, and Phone a Friend, with a limit of three lifeline uses. Selecting and locking an answer turns the option green or red, advances the prize amount on a correct answer, or ends the game and falls back to the last protected checkpoint on a wrong one. A win screen congratulates the participant by name with their total winnings. The AddQuestions screen lets organizers submit new questions with level and correct-option selectors, view all questions, and reset the entire bank between games.

## Tech stack
Frontend: React 17, React Router DOM 6, Axios, Bootstrap 5 and react-bootstrap, react-scripts. Backend: Node.js, Express 4, Mongoose 6, body-parser, CORS, and Node's http module, connected to a MongoDB Atlas cluster.

## Challenges
The main complexity lives in the game-state machine: synchronizing a setInterval-driven countdown with React state via a tick "linker," computing checkpoint-protected fallback winnings, and coordinating lifeline side effects (including a database write to mark flipped questions used) without breaking the question flow. Timer logic, color/state resets between questions, and the random non-repeating question selection all had to be juggled inside hooks.

## Outcome
The result is a working prototype tailored to a single live event. It is wired entirely to localhost with the MongoDB connection string committed in source and no authentication, so it is best understood as a functional fest-utility and a solid full-stack learning project rather than a production-grade application.

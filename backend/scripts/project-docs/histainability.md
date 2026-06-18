## Overview
Histainability ("working towards sustainability through the eyes of history") is a native Android application built in Kotlin that connects the United Nations' 17 Sustainable Development Goals (SDGs) to long-run historical word-usage trends. The app is structured around four sections accessible from the home screen: a Graph explorer, a Quiz, an "Other Apps"/links page, and Settings.

## Problem / Motivation
The team's premise, stated in the README, is that important challenges such as food insecurity are under-discussed while trivial topics dominate public attention, and that "those who forget history are condemned to repeat it." The goal is to surface, for each SDG, the historical patterns and events that shaped how society thinks about that issue, making the abstract goals more tangible and memorable for learners.

## How it works / Architecture
The app uses a classic XML-layout, multi-Activity Android architecture (no Jetpack Compose). MainActivity routes to SdgMenu, QuizMenu, SettingsActivity, and LinkActivity. The core feature lives in DisplayGraph: when a user picks one of the 17 goals, the app builds a Google Books N-gram URL for the goal's keyword (year_start=1900, year_end=2019, corpus 26, smoothing 3), fetches it asynchronously with an OkHttp3 enqueue callback, and deserializes the returned JSON into a GraphFeed data class with Gson. The timeseries array is rendered as a filled, zoomable, animated LineChart using MPAndroidChart, while a RecyclerView below it shows historical "event cards" (year, title, description, and a tappable like counter) drawn from a static in-memory data object holding events for all 17 goals. The Quiz path (QuizMenu to QuizActivity) loads goal-specific multiple-choice questions into a RecyclerView whose adapter renders four radio-button options per question and reports the user's choice back via a callback interface; on submit, the activity tallies correct answers and displays a percentage score.

## Key features
Interactive per-goal trend graphs sourced live from Google N-grams; curated historical event cards for each SDG; a scored, refreshable quiz per goal; dark/light theme toggling via AppCompatDelegate; and localization across English, Hindi, and Telugu to broaden accessibility.

## Tech stack
Kotlin on the Android SDK (compileSdk 30, minSdk 19, targetSdk 30), built with Gradle. Networking uses OkHttp3, JSON parsing uses Gson, and charting uses MPAndroidChart (via JitPack). The UI relies on AndroidX AppCompat, Material Components, ConstraintLayout, the Navigation components, RecyclerView, and Kotlin synthetic view binding. The only declared permission is INTERNET.

## Challenges
The most notable implementation choice is synchronizing the asynchronous OkHttp call with a CountDownLatch so the chart data is ready before rendering - a pragmatic but blocking approach. Other challenges include mapping each SDG to an appropriate n-gram query term, parsing the somewhat unusual Google N-gram JSON response, and maintaining a large body of hardcoded event and quiz content across all 17 goals without any database.

## Outcome
The result is a working educational prototype (with a recorded demo video) that successfully marries real public data with a quiz-based learning loop. Its scope is student/hackathon-level: content is static and there is no backend, authentication, or persistence, and the README's "future goals" list a more interactive graph, user-contributed quiz questions, Google login for schools, and additional Indian languages.

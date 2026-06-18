## Overview
Helping Nemo is a 2D educational game developed in the Unity engine (version 2020.3.26f1 LTS) using C#. The player controls Nemo, a small cleaning robot deployed from a mothership, to clean three forms of ocean pollution: floating garbage, oil spills, and fishing nets that trap marine animals. The game is structured as five progressive levels plus an endless survival mode and is deployed to the web via Unity's WebGL build target, hosted on simmer.io.

## Problem / Motivation
The project was conceived as an awareness vehicle around water pollution. It deliberately models three real-world threats the developers identified: garbage dumped into oceans, industrial oil spills, and animals (turtles) becoming entangled in nets and plastic. A notable design decision reinforces the message: all game art is pixelated except the garbage and nets, which are rendered in higher fidelity so they visually "don't belong" in the scene, serving as a subtle metaphor for pollution being out of place in nature.

## How it works / Architecture
The game is built entirely in Unity's 2D pipeline, relying on Rigidbody2D and Collider2D physics. Gameplay logic lives in roughly 21 C# scripts under Assets/Scripts. The central controller, MoveNemo.cs, handles player movement (WASD/arrow keys), garbage collection input, per-task progress bars, scoring, and the win/loss conditions that govern level progression. Each pollution type has a dedicated mechanic: Net.cs detects nearby trapped turtles and processes net-cutting; OilSpill.cs models oil blobs that grow and drift, shrinking as the player vacuums them; and GunBehaviour.cs fires a sonar pulse used to destroy garbage. EnemySpawner.cs continuously spawns randomized garbage prefabs (bags, bottles, tires) at screen edges, while Fish.cs adds ambient sea life. Timer.cs drives the countdown that bounds each level and extends time during survival mode. Scene management is split across menu, intro, character-intro, and per-level scenes, with LevelLoader.cs and Timeline-driven transitions tying them together.

## Key features
Five distinct levels each emphasize a mechanic before combining them: Level 1 garbage collection, Level 2 turtle rescue via net cutting, Level 3 oil cleanup, Level 4 all three together, and Level 5 a harder pro mode with stricter time limits and higher score thresholds. A survival mode loops endlessly, granting bonus time whenever all three collectors are filled. The HUD shows separate progress bars per task, a countdown timer, and on-screen help. Controls map collection actions to number keys, with a toggleable help overlay.

## Tech stack
Unity 2020.3 LTS with C# scripting; Unity 2D Sprite, 2D Animation, Pixel Perfect, and Tilemap packages; TextMeshPro and uGUI for UI; Unity Timeline for intro cutscenes; the 2D physics module for movement and collisions; and the WebGL build target for browser deployment. The project is 2D-only with no 3D modules loaded.

## Challenges
Coordinating three independent collection mechanics with shared scoring and progress UI, then layering them into combined and endless modes, required careful state management across levels. Spawner timing, oil-blob growth behavior, and respawning freed animals off-screen all needed tuning to feel fair within the time limits. Building cleanly for WebGL while keeping the pixel-art aesthetic and Timeline cutscenes intact added deployment constraints.

## Outcome
The result is a complete, publicly playable browser game produced by a five-person student team and hosted on simmer.io. It demonstrates end-to-end 2D Unity development - input handling, physics, spawners, UI/progress systems, level flow, and WebGL packaging - in service of an environmental-awareness theme rather than commercial goals.

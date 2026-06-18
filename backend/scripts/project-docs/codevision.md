## Overview
CodeVision, presented in its README as the "Blind Debugger Extension," is a Visual Studio Code extension designed to make code navigation accessible to blind and visually impaired programmers. Rather than relying on visual inspection, it converts a project's folder hierarchy and the internal structure of its Python files into a tree of spoken nodes that the user moves through with the keyboard or on-screen buttons, hearing each element read aloud.

## Problem / Motivation
Reading and debugging code is an inherently visual task, which excludes programmers who cannot see the screen well or at all. The project's goal is to serve as the "eye of the programmer," parsing folders and files into a structured tree (folder structure plus, for Python files, classes, functions, imports, and even per-function code blocks) so that a developer can build a mental model of a codebase entirely through audio and keyboard navigation.

## How it works / Architecture
The extension's entry point (src/extension.ts) activates on a custom Explorer webview view. On activation it collects VS Code language diagnostics (errors/warnings) for the active file and writes them to a file, then shells out to generate a directory listing: the OS tree command on Windows (and tree -q on Linux), saving the result to a text file. It also spawns PowerShell with System.Speech to enumerate installed Windows voices. The parsing engine (src/Parsing/treeParsing.ts) defines TreeNode and Tree classes (with pre-order, post-order, insert, remove, and find operations) and a ReadFile class that reads the generated tree text, reconstructs an n-ary tree using an indentation/level-gap stack algorithm, and then deep-parses each Python file into import, class, function, and code-block child nodes. Files with diagnostics get a dedicated error node instead. The UI layer (src/providers/TreeViewProvider.ts) implements a WebviewViewProvider rendering an HTML panel built with the VS Code Webview UI Toolkit; the webview script wires six buttons and number-key bindings to post messages (start, next/previous node, next/previous level, stop) back to the provider, which walks the tree and triggers speech.

## Key features
Audio navigation of an entire project tree; deep Python parsing that announces classes, functions, parameter lists, and imports; distinct text-to-speech voices for normal content versus error lines (using a prefix to switch to a secondary voice); keyboard shortcuts mirroring the GUI buttons; and a small weather widget inherited from the sample template the project was scaffolded from.

## Tech stack
TypeScript compiled via tsc, the VS Code Extension API (engines.vscode ^1.55), the VS Code Webview UI Toolkit for the panel UI, the "say" npm package for cross-platform text-to-speech, weather-js for the demo weather call, Node.js child_process/fs for invoking the tree command and reading files, plus ESLint and Prettier for tooling. The webview front end is plain HTML, CSS, and JavaScript.

## Challenges
The most notable engineering challenge is platform portability: the parser branches on process.platform, handles ANSI-colored Linux tree output versus Windows CRLF output differently, and contains a TODO noting LF line endings are unhandled. Other challenges visible in the code include reconstructing tree depth from text indentation, coordinating asynchronous file reads and timeouts during parsing, and managing speech state across webview message round-trips.

## Outcome
CodeVision is a working accessibility prototype that proves an audio-first, keyboard-driven approach to code comprehension. As acknowledged in its "Future Work" section, the approach is static and could be extended into a dynamic debugger and to languages beyond Python; in its current form it is best understood as a hackathon/learning-stage proof of concept rather than a polished, fully cross-platform product.

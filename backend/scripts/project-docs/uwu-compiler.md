## Overview
UwU Compiler is a complete, from-scratch compiler for a custom-designed imperative programming language named "UwU," built as a compiler-construction project at IIT. It takes UwU source files (.uwu) and walks them through every classical compiler stage to ultimately emit MIPS assembly that can be loaded and simulated in QtSpim.

## Problem / Motivation
The goal was to design a bespoke language combining familiar constructs from existing languages and then build the full toolchain to compile it, in order to practically exercise the theory of compiler design rather than studying it in the abstract. The language supports assignment, comparison, multiple expressions, looping, and conditionals, and the team deliberately kept the project modular so each phase could be developed and improved independently.

## How it works / Architecture
The pipeline is staged. A C++ preprocessor (preprocessor.cc) first scans the source for include directives (header/file inclusion) and define macros (textual substitution), producing a consolidated intermediate file. Lexical analysis is performed by a Lex file (lexer.l) containing regular expressions for keywords (let, const, if, else, loop, stop, continue, function, return, print, main, input), operators, delimiters, identifiers, integers, floats, and strings; it tracks line numbers and builds a token stream. Syntax and semantic analysis are handled by a Yacc file (lexer.y) implementing an LALR(1) grammar following the S-attributed grammar model. Each production carries C++ semantic actions that build a binary parse/AST tree of node structs and populate a fixed-size symbol-table array (identifier name, data type, kind, line number). Intermediate code generation happens inside those same actions: each node accumulates a synthesized three-address-style IR using temporaries, labels, and explicit GOTO / IF_FALSE control flow. The IR for the whole program is written to a file. Finally, a Python backend (ir_to-mips.py) reads the IR, builds a data section from declarations, performs register allocation across the MIPS register banks (with spilling), and translates each IR statement into MIPS instructions. A shell script orchestrates make, preprocessing, parsing, and the Python codegen.

## Key features
The language supports let/const variable declarations with inferred types (INT, FLOAT, STRING, ARRAY); arithmetic, bitwise, and logical operators; compound assignment and increment/decrement; if/else/else-if conditionals; loop constructs with stop and continue; multi-dimensional arrays with index flattening; function definitions and calls with parameter passing and return values; and built-in print and input I/O lowered to MIPS syscalls. String concatenation is supported via an inlined MIPS routine.

## Tech stack
C++ (semantic actions, preprocessor, tree/symbol table), Lex/Flex (scanner), Yacc/Bison (LALR(1) parser), Python (IR-to-MIPS backend and register allocation), Bash (driver script), GNU Make (build), and MIPS assembly executed under QtSpim.

## Challenges
The hardest parts were keeping a consistent IR contract between the C++ frontend and the Python backend, generating correct label-based control flow for nested conditionals and loops, flattening multi-dimensional array indices into linear offsets, and implementing register allocation with spilling. Error recovery uses Yacc's error token to record offending line numbers and report them after parsing.

## Outcome
The result is a working end-to-end compiler that turns a custom high-level language into simulatable MIPS assembly, with a deliberately decoupled code-generation stage that let the team switch their target from x86 to MIPS. Limitations are honest and scope-appropriate: no classes or structs, and execution targets the QtSpim simulator rather than physical hardware.

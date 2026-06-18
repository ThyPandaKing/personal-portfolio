## Overview
Bytify is a desktop simulator for the MIPS assembly language, implemented entirely in Python with a Tkinter graphical interface. It reads an assembly source file (.s or .asm), separates the data and text segments, executes the program instruction by instruction, and renders the machine state - registers, data/memory segment, console output, pipeline timeline, and cache statistics - in a windowed GUI. The project was developed in three incremental phases between February and May 2021.

## Problem / Motivation
Understanding processor internals such as instruction pipelining, data hazards, and cache behavior is difficult from textbooks alone. Existing tools like MARS or SPIM show register state but offer limited intuition about why stalls occur or how a multi-level cache performs. Bytify was built as a teaching aid that runs real MIPS programs and visually exposes these microarchitectural effects, so the relationship between code and hardware behavior becomes concrete.

## How it works / Architecture
The codebase is organized as plain Python modules. InputFile.py reads the source, strips comments and blank lines, and splits the program at the .text directive into a data segment and an instruction list. memorySegment.py fills a flat memory array from .word and .asciiz directives and records labeled memory addresses. The core engine lives in main.py, which models the canonical five pipeline stages as a chain of functions: InstructionFetch, InstructionDecode, execution, mem, and writeBack. The decoder validates operand counts and register/label names per opcode and normalizes load/store operands. A global register dictionary (mirroring the 32 MIPS registers plus stack and return-address registers, stored as hex) and a 1024-entry data segment hold machine state.

## Key features
The simulator supports arithmetic (add, sub, mul, div, addi), bitwise (and, or, not, sll, srl, andi), initialization (li, la, move), branch/jump (slt, beq, bne, j, jr), memory (lw, sw), and syscall-based printing of integers and strings. Pipeline simulation tracks the previous two instructions to detect data dependencies; when data forwarding is disabled it inserts three stalls, when enabled it forwards from EXE-MEM or MEM-WB (with a one-stall penalty for load-use hazards), and it implements a branch-not-taken predictor that stalls only on a taken branch. It reports total stalls, a cycle-by-cycle pipeline grid, data-forwarding events, and average IPC. The cache subsystem models two configurable levels with tag/index/offset decomposition, LRU replacement, and write-through updates, computing L1 and L2 hit rates. The GUI allows loading a file, optionally uploading cache parameters, editing instructions by program counter, single-step or full execution, and a restart option.

## Tech stack
Python with the standard-library Tkinter toolkit (Text, Entry, Label, Scrollbar, filedialog), plus math and copy. There are no external dependencies or build tooling - the program is launched by running main.py.

## Challenges
The main difficulties were modeling pipeline hazards correctly (distinguishing arithmetic dependencies, load-use stalls, and branch misprediction across the previous two instructions) and tracking forwarding registers through the staged function pipeline, alongside building the LRU two-level cache and synchronizing all of this state into the reactive Tkinter tables.

## Outcome
The result is a working, GUI-driven MIPS simulator that demonstrates execution, pipelining, and caching together. The authors document known limitations - integer-rather-than-byte memory and no hexadecimal input - and list future work such as parallelizing pipeline stages and adding runtime error detection, marking it as a solid instructional project rather than a production assembler.

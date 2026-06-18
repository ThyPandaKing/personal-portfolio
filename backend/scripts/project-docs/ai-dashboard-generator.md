## Overview
The AI-Powered Dashboard Generator is a generative-AI tool that builds dashboards on the ServiceNow platform directly from a natural-language prompt. A user describes the dashboard they want in plain English - the metrics, the data, the breakdowns - and the system assembles the corresponding dashboard, allowing virtually any kind of dashboard to be created without manual report configuration.

## Problem / Motivation
Building dashboards on an enterprise platform traditionally requires hands-on knowledge of the underlying data model, report types, aggregations, and visualization options. That expertise barrier makes dashboard creation slow and largely the preserve of technical users, leaving business stakeholders dependent on others for the views they need. The goal was to collapse that effort into a single prompt, so anyone could describe a dashboard and have it generated for them.

## How it works / Architecture
The tool turns a user's prompt into a working dashboard through a language-model-driven pipeline. The natural-language request is sent, via REST, to a large language model (LLM) that interprets the user's intent and maps it onto the platform's dashboard and reporting schema - identifying the relevant tables and fields, the aggregations and filters, and the appropriate visualization types for each requested widget. The resulting specification is then used to generate and configure the dashboard through the platform's APIs. Because the generation targets the platform's native dashboard primitives, the output is a first-class ServiceNow dashboard that behaves like any hand-built one.

## Key features
Natural-language prompt to a fully configured dashboard; support for arbitrary dashboard types and layouts; LLM-driven interpretation of intent into concrete data sources, aggregations, and visualizations; automated generation of widgets and reports against the platform's data model; and platform-native output that integrates with existing reporting and permissions.

## Tech stack
The generator combines a large language model (accessed via REST) for natural-language understanding and specification, the ServiceNow platform's dashboard and reporting APIs for generation, and server-side JavaScript to orchestrate prompt handling, schema mapping, and dashboard construction.

## Outcome / Impact
The tool democratizes dashboard creation: non-technical stakeholders can stand up tailored dashboards simply by describing them, removing the dependency on specialists and the manual configuration effort that dashboards normally require. It demonstrates a practical, platform-native application of generative AI to a concrete enterprise reporting workflow.

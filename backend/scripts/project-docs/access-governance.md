## Overview
The Access Review & Governance platform is an event-driven system that automates how access rights are reviewed, certified, and audited across an enterprise. Built on a microservices architecture, it continuously processes access-related events and orchestrates the review workflows that keep entitlements correct and audit-ready, removing the manual effort and risk traditionally associated with periodic access certification.

## Problem / Motivation
Access governance - confirming who has access to what, why, and whether it is still appropriate - is a recurring compliance obligation that is typically handled through manual, spreadsheet-driven review campaigns. These are slow, error-prone, and a frequent source of audit findings. The objective was to deliver an automated, event-driven governance system that keeps access continuously reviewed and produces clean, defensible audit evidence every cycle.

## How it works / Architecture
The platform is composed of decoupled microservices that communicate asynchronously through an internal event broker. Access events - grants, revocations, role changes, and related activity - are published to the broker; downstream services consume them, evaluate them against governance policies, drive the appropriate review and certification workflows, and persist an audit trail of decisions and evidence. The event-driven, microservices design keeps the components independently scalable and maintainable, and ensures that access changes are processed reliably as they happen rather than swept up in a periodic batch.

## Key features
Automated access reviews and certifications; event-driven processing of access changes through an internal asynchronous message broker; a microservices architecture with independently deployable services; policy-based evaluation of entitlements; a complete, queryable audit trail for evidence; and continuous operation that replaces manual review campaigns.

## Tech stack
The system is built in Node.js as a set of microservices coordinated through an internal asynchronous event broker (publish-subscribe), with REST APIs between services and integrations into the surrounding enterprise platform. The architecture emphasizes loose coupling and horizontal scalability.

## Outcome / Impact
The platform was delivered end to end and eliminated 800+ manual hours per year previously spent on access-review campaigns. Critically, it achieved zero audit failures across all compliance cycles in which it operated - turning a historically painful, finding-prone process into a reliable, automated, and continuously auditable one.

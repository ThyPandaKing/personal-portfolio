I want to build my own personal portfolio website using advance technologies, I will be explaining all the functional details one by one. Given below is the overall bigger techstack to use, keep MongoDB as database.

There will be 2 kind of users, first will be "Visitor (no login needed)" who can "view" all the information, chat with chatbot, send emails etc, other will be "admin" (me, logged in via Gmail) who can do all the CRUD operations. Keep the design open to extension and use standard practices across the industry where-ever applied.

'''project/

frontend/
 └─ React

backend/
 └─ Node Express

agent-service/
 └─ Python
     ├─ LangGraph
     ├─ Tools
     ├─ RAG
     └─ FastAPI

docker-compose.yml'''

1. Home Page (all informatio editable by Admin)
    - About me 
    - Skills
    - Image
    - Social media profiles
    - Education level and course details

2. Projects
 - 3 type of projects, Enterprise, Personal, Archive
 - All projects should be written with similar format => About, impact, learning, skills used, demo link, github link
 - Admin should have option to add/remove/ edit project and make it archive
 - Each project can be associated to multiple recordings and pdf files


3. Resume
- 2 visible resume for public (selected by admin)
- SDE role and AI role
- ADMIN ONLY: Admin should see a "resume generator" service, that can use AI + Projects (selectable by Admin) + Skills (selectable) + additional details/instructions (given by admin at time of creation) and should be able to create a resume


4. Chatbot:
- Written in Python, connected with frontend via other APIs, should have DB access to fetch project details and should be RAG enabled for all the projects and other relected documents
- Documents can be added and model can again be trained

5. Blogs
- Blogs written by Admin 

Common Instructions:

- For AI use Gemini LLM for now
- Make the UI very beautiful and self explanatory
- Keep the UI theme Dark/Light (selected by anyone)


Prompt:

Software Engineer 2: 

Time: Feb 2026 – Present
Company: ServiceNow Hyderabad, India

- Worked on CCM (Contineous Compliance Monitoring) framework which integrates with 10+ systems and ensures continous compliance by tsting 100% sample size. 
- Framework monitors and tracks all changes, access and config across various platforms, and flags any discrepency.
- This uses ServiceNow Event queues, scripting, mailing and dashboarding. end-to-end solution.
- Owned architecture of a low-latency (<500ms p99) continuous controls monitoring platform using async pub-sub messaging and horizontal scaling; system sustains 10,000+ events/day throughput with sub-second processing under peak load, enabling 5,000+ automated hours/year.



Software Engineer: 

Time: July 2023 - Feb 2026
Company: ServiceNow Hyderabad, India

- Led end-to-end design and delivery of an event-driven access governance system built on a microservices architecture using Node.js and an internal async event broker; eliminated 800+ manual hours/year and achieved zero audit failures across all compliance cycles.


- Architected LLM-powered (GPT-4 via REST) workflows for control analysis and automated remediation
recommendations; reduced mean investigation time by 60% and cut analyst escalations significantly.


Software Engineering Intern 

Time: May 2022 – July 2022
Company: ServiceNow Hyderabad, India
- Built automated integration testing pipelines using parallel async execution, reducing end-to-end test suite runtime
by 40%.
- Designed failure detection pipelines covering authentication, server, and payload error classes; improved defect
coverage and reduced production escape rate.
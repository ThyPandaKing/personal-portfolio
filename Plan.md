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
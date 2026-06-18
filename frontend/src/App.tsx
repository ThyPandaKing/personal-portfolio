import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { warmup } from "./api/chat";
import Layout from "./components/layout/Layout";
import RequireAdmin from "./components/RequireAdmin";
import Spinner from "./components/ui/Spinner";

// Public pages
const Home = lazy(() => import("./pages/Home"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Resume = lazy(() => import("./pages/Resume"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogDetail = lazy(() => import("./pages/BlogDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages (heaviest — only loaded for the admin)
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const ProfileEditor = lazy(() => import("./pages/admin/ProfileEditor"));
const ProjectsAdmin = lazy(() => import("./pages/admin/ProjectsAdmin"));
const BlogAdmin = lazy(() => import("./pages/admin/BlogAdmin"));
const ResumesAdmin = lazy(() => import("./pages/admin/ResumesAdmin"));
const ChatbotAdmin = lazy(() => import("./pages/admin/ChatbotAdmin"));

export default function App() {
  // Pre-heat the free-tier backends on first load so the chatbot is ready fast.
  useEffect(() => {
    void warmup();
  }, []);

  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:slug" element={<ProjectDetail />} />
          <Route path="resume" element={<Resume />} />
          <Route path="blog" element={<Blog />} />
          <Route path="blog/:slug" element={<BlogDetail />} />

          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminHome />} />
            <Route path="profile" element={<ProfileEditor />} />
            <Route path="projects" element={<ProjectsAdmin />} />
            <Route path="blog" element={<BlogAdmin />} />
            <Route path="resumes" element={<ResumesAdmin />} />
            <Route path="chatbot" element={<ChatbotAdmin />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

import { Outlet } from "react-router-dom";
import Background from "../Background";
import ChatWidget from "../chat/ChatWidget";
import Footer from "./Footer";
import Navbar from "./Navbar";

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Background />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}

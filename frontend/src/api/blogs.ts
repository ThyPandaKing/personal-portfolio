import { api } from "../lib/api";
import type { Blog } from "../types";
import { endpoints } from "./endpoints";

export interface BlogFilters {
  tag?: string;
  q?: string;
}

export async function fetchBlogs(filters: BlogFilters = {}): Promise<Blog[]> {
  const params: Record<string, string> = {};
  if (filters.tag) params.tag = filters.tag;
  if (filters.q) params.q = filters.q;
  const { data } = await api.get<Blog[]>(endpoints.blogs.root, { params });
  return data;
}

export async function fetchBlog(slug: string): Promise<Blog> {
  const { data } = await api.get<Blog>(endpoints.blogs.bySlug(slug));
  return data;
}

export type BlogInput = Pick<
  Blog,
  "title" | "excerpt" | "content" | "coverImage" | "tags" | "published"
>;

export async function createBlog(payload: Partial<BlogInput>): Promise<Blog> {
  const { data } = await api.post<Blog>(endpoints.blogs.root, payload);
  return data;
}

export async function updateBlog(id: string, payload: Partial<BlogInput>): Promise<Blog> {
  const { data } = await api.put<Blog>(endpoints.blogs.byId(id), payload);
  return data;
}

export async function deleteBlog(id: string): Promise<void> {
  await api.delete(endpoints.blogs.byId(id));
}

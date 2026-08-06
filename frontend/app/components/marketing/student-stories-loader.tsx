"use client";

import dynamic from "next/dynamic";

import type { StudentStoriesProps } from "./student-stories";

const LazyStudentStories = dynamic(
  () => import("./student-stories").then((module) => module.StudentStories),
  {
    loading: () => (
      <div aria-busy="true" className="stories-empty">
        <p>Preparing the example journeys…</p>
      </div>
    ),
  },
);

export function StudentStoriesLoader(props: StudentStoriesProps) {
  return <LazyStudentStories {...props} />;
}

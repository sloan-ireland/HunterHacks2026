"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

interface Course {
  course_id: number;
  code: string;
  title: string;
  prerequisites?: string;
  corequisites?: string;
  descriptions?: string[];
  completed: boolean;
}

export default function Home() {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const eligibleRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (index: number) => {
    setExpanded((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  useEffect(() => {
    const fetchCourses = async () => {
      console.log("Fetching courses from Supabase...");
      const { data, error } = await supabase.from("courses").select("*");
      if (error) {
        console.error("Supabase error:", error);
        return;
      }
      setCourses(data || []);
    };
    fetchCourses();
  }, []);

  const markAsCompleted = async (course_id: number) => {
    const { error } = await supabase
      .from("courses")
      .update({ completed: true })
      .eq("course_id", course_id);

    if (!error) {
      setCourses(prev =>
        prev.map(c => c.course_id === course_id ? { ...c, completed: true } : c)
      );
    }
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex h-screen">

      {/* Sidebar */}
      <div className={`bg-gray-900 text-white transition-all duration-300 ${open ? "w-60" : "w-16"}`}>
        <div className="p-4 cursor-pointer" onClick={() => setOpen(!open)}>
          <Image src="/menu.jpg" alt="menu" width={30} height={20} />
        </div>

        {open && (
          <div className="flex flex-col gap-4 px-4">
            <div
              className="hover:bg-gray-800/50 p-2 rounded cursor-pointer"
              onClick={() => scrollToSection(eligibleRef)}
            >
              Eligible Courses
            </div>
            <div
              className="hover:bg-gray-800/50 p-2 rounded cursor-pointer"
              onClick={() => scrollToSection(completedRef)}
            >
              Completed Courses
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-black p-6 text-white overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6">Computer Science Major</h1>

        {/* Eligible Courses */}
        <div ref={eligibleRef}>
          <h2 className="text-xl font-semibold mb-4">Eligible Courses</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.filter(c => !c.completed).map((course, index) => {
              const isOpen = expanded.includes(index);
              return (
                <div key={course.course_id} className="bg-gray-800/80 p-4 rounded-xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold">{course.code}</h2>
                      <h3 className="text-sm text-gray-400">{course.title}</h3>
                    </div>
                    <button onClick={() => toggleExpand(index)}>
                      <Image
                        src="/drop_down.jpg"
                        alt="toggle"
                        width={20}
                        height={20}
                        className={isOpen ? "rotate-180" : ""}
                      />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="text-sm mt-3 space-y-2">
                      <p><b>ID:</b> {course.course_id}</p>
                      <p><b>Description:</b> {course.descriptions?.[0] || "No description"}</p>
                      <p><b>Prerequisites:</b> {course.prerequisites || "None"}</p>
                      <p><b>Corequisites:</b> {course.corequisites || "None"}</p>

                      <button
                        className="mt-2 px-2 py-1 bg-green-600 rounded hover:bg-green-500"
                        onClick={() => markAsCompleted(course.course_id)}
                      >
                        Mark as Completed
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Completed Courses */}
        <div ref={completedRef} className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Completed Courses</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.filter(c => c.completed).map((course) => (
              <div key={course.course_id} className="bg-gray-700/80 p-4 rounded-xl text-gray-300">
                <h3 className="font-semibold">{course.code}</h3>
                <p>{course.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
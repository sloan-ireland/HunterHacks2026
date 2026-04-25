"use client";

import { useState } from "react";
import Image from "next/image";

export default function Home() {
  const [open, setOpen] = useState(true);

  /* NEW: track which cards are expanded */
  const [expanded, setExpanded] = useState<number[]>([]);

  const toggleExpand = (index: number) => {
    setExpanded((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index) // collapse
        : [...prev, index] // expand
    );
  };

  const courses = [
    { code: "CSCI 200", title: "Algorithms", desc: "Lorem ipsum dolor sit amet." },
    { code: "CSCI 201", title: "Data Structures", desc: "Lorem ipsum dolor sit amet." },
    { code: "CSCI 202", title: "Databases", desc: "Lorem ipsum dolor sit amet." },
    { code: "CSCI 203", title: "Operating Systems", desc: "Lorem ipsum dolor sit amet." },
    { code: "CSCI 204", title: "Software Engineering", desc: "Lorem ipsum dolor sit amet." },
    { code: "CSCI 205", title: "AI Basics", desc: "Lorem ipsum dolor sit amet." },
  ];

  return (
    <div className="flex h-screen">

      {/* Sidebar */}
      <div className={`bg-gray-900 text-white transition-all duration-300 ${open ? "w-60" : "w-16"}`}>
        <div className="p-4 cursor-pointer" onClick={() => setOpen(!open)}>
          <Image src="/menu.jpg" alt="menu" width={30} height={20} />
        </div>

        {open && (
          <div className="flex flex-col gap-4 px-4">
            <div className="hover:bg-gray-800 p-2 rounded cursor-pointer">Dashboard</div>
            <div className="hover:bg-gray-800 p-2 rounded cursor-pointer">Completed Courses</div>
            <div className="hover:bg-gray-800 p-2 rounded cursor-pointer">Eligible Courses</div>
            <div className="hover:bg-gray-800 p-2 rounded cursor-pointer">Planner</div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-black p-6 text-white overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6">Computer Science Major</h1>
        <h1 className="text-1 font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course, index) => {
            const isOpen = expanded.includes(index);

            return (
              <div
                key={index}
                className="bg-gray-800 p-4 rounded-xl shadow transition"
              >
                {/* Header row */}
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold">{course.code}</h2>
                    <h3 className="text-sm text-gray-400">{course.title}</h3>
                  </div>

                  {/* Dropdown button */}
                  <button onClick={() => toggleExpand(index)}>
                    <Image
                      src="/drop_down.jpg"
                      alt="toggle"
                      width={20}
                      height={20}
                      className={`transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* Hidden/Shown Description */}
                {isOpen && (
                  <p className="text-sm mt-3">
                    {course.desc}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";

export function PreviewGreeting() {
  const [name, setName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("kin_family_name");
    if (stored) setName(stored);
  }, []);

  return (
    <h1 className="font-display text-[2rem] leading-tight text-text-primary tracking-[-0.01em]">
      Hey{name ? `, ${name}` : " there"} 👋
    </h1>
  );
}

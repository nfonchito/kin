"use client";

import { useState, useEffect } from "react";

export function PreviewGreeting() {
  const [name, setName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("kin_family_name");
    if (stored) setName(stored);
  }, []);

  return (
    <h1 className="text-lg font-semibold text-text-primary">
      Hey{name ? `, ${name}` : " there"} 👋
    </h1>
  );
}

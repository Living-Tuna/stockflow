"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function useThemeLogo(): string {
  const { resolvedTheme } = useTheme();
  const [logo, setLogo] = useState("/logo.svg");

  useEffect(() => {
    setLogo("/logo.svg");
  }, [resolvedTheme]);

  return logo;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readAuthCookie } from "@/utils/auth-cookie";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    const token = readAuthCookie();
    if (token) {
      router.replace("/map-view");
    } else {
      router.replace("/login");
    }
  }, [router]);
  return null;
}

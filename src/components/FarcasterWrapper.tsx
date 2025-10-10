"use client";
import React from "react";

export default function FarcasterWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // If you later add a real Farcaster provider, wrap it here.
  return <>{children}</>;
}

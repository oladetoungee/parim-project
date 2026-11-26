"use client";

import { createContext, useContext } from "react";

/**
 * Where the app's pages live. /v2 (top bar) and /v3 (sidebar) share the
 * Schedule, People and Requests screens, so their links read the base from here.
 */
export const AppBase = createContext("/v2");

export function useAppBase() {
  return useContext(AppBase);
}

import pkg from "../package.json";

export const APP_VERSION: string = pkg.version;

/**
 * Which build this is: the start of the git commit it was built from (set by CI as
 * VITE_BUILD_ID), so two builds with the same version number can be told apart.
 */
export const BUILD_ID: string = ((import.meta.env.VITE_BUILD_ID as string | undefined) ?? "").slice(0, 7) || "dev";

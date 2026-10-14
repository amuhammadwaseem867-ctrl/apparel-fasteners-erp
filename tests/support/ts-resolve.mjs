/*
 * Test-only module resolution for TypeScript sources.
 *
 * Application code imports TypeScript modules without an extension
 * ("./decimal"), which Next.js resolves but Node's type stripping does not.
 * For relative specifiers that fail to resolve, retry with ".ts" and
 * "/index.ts". Bare and aliased ("@/...") specifiers are left untouched.
 */

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../");

    if (!relative || error?.code !== "ERR_MODULE_NOT_FOUND") {
      throw error;
    }

    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // try the next candidate
      }
    }

    throw error;
  }
}

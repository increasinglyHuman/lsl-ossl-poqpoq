/**
 * Bundle Transpiler — Batch-transpile all LSL scripts from a parsed OAR bundle.
 *
 * Takes a ParsedBundle (from BundleParser) and a map of script sources,
 * transpiles each LSL script to TypeScript, and collects results.
 */

import { transpile } from "../../transpiler/transpile.js";
import type { TranspileOptions, TranspileResult } from "../../transpiler/types.js";
import type { Diagnostic } from "../../transpiler/errors.js";
import type { ParsedBundle, ScriptBinding } from "./bundle-types.js";

/** Result of transpiling a single script within a bundle */
export interface TranspiledScript {
  /** The original binding (object ID, script name, asset path) */
  readonly binding: ScriptBinding;
  /** The transpilation result */
  readonly result: TranspileResult;
}

/** Aggregate result of transpiling all scripts in a bundle */
export interface TranspiledBundle {
  readonly sceneName: string;
  readonly scripts: TranspiledScript[];
  readonly successCount: number;
  readonly failureCount: number;
  readonly diagnostics: BundleDiagnostic[];
}

/** A diagnostic tied to a specific script in the bundle */
export interface BundleDiagnostic {
  readonly objectId: string;
  readonly objectName: string;
  readonly scriptName: string;
  readonly assetPath: string;
  readonly diagnostic: Diagnostic;
}

export class BundleTranspiler {
  /**
   * Transpile all LSL scripts in a parsed bundle.
   *
   * @param bundle        ParsedBundle from BundleParser
   * @param scriptSources Map of assetPath → LSL source code
   * @param options       Optional transpile options (applied to all scripts)
   */
  transpile(
    bundle: ParsedBundle,
    scriptSources: Map<string, string>,
    options?: Partial<TranspileOptions>
  ): TranspiledBundle {
    const scripts: TranspiledScript[] = [];
    const diagnostics: BundleDiagnostic[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Track class names for deduplication
    const usedClassNames = new Set<string>();

    for (const binding of bundle.scripts) {
      const source = scriptSources.get(binding.assetPath);

      if (source === undefined) {
        // Missing source — record as error diagnostic, don't crash
        failureCount++;
        const errorDiag: Diagnostic = {
          severity: "error",
          message: `Source file not found: ${binding.assetPath}`,
        };
        diagnostics.push({
          objectId: binding.objectId,
          objectName: binding.objectName,
          scriptName: binding.scriptName,
          assetPath: binding.assetPath,
          diagnostic: errorDiag,
        });
        scripts.push({
          binding,
          result: {
            code: "",
            success: false,
            diagnostics: [errorDiag],
            className: this.deriveClassName(binding.scriptName, usedClassNames),
          },
        });
        continue;
      }

      // Derive a unique class name from the script name
      const className = this.deriveClassName(binding.scriptName, usedClassNames);
      usedClassNames.add(className);

      const result = transpile(source, {
        className,
        filename: binding.assetPath,
        ...options,
      });

      scripts.push({ binding, result });

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Collect diagnostics with bundle context
      for (const diag of result.diagnostics) {
        diagnostics.push({
          objectId: binding.objectId,
          objectName: binding.objectName,
          scriptName: binding.scriptName,
          assetPath: binding.assetPath,
          diagnostic: diag,
        });
      }
    }

    return {
      sceneName: bundle.sceneName,
      scripts,
      successCount,
      failureCount,
      diagnostics,
    };
  }

  /**
   * Derive a PascalCase class name from a script inventory name.
   * Handles deduplication by appending _2, _3, etc.
   */
  deriveClassName(scriptName: string, usedNames: Set<string>): string {
    // Sanitize: remove non-alphanumeric, convert to PascalCase
    let name = scriptName
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");

    // Ensure it starts with a letter
    if (!name || !/^[A-Z]/.test(name)) {
      name = "Script" + name;
    }

    // Deduplicate
    let candidate = name;
    let counter = 2;
    while (usedNames.has(candidate)) {
      candidate = `${name}_${counter}`;
      counter++;
    }

    return candidate;
  }
}

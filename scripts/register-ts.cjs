// Simple TS loader using TypeScript's transpileModule so we can run .ts scripts
// without installing additional tooling.
const fs = require("fs");
const Module = require("module");
const { transpileModule } = require("typescript");

Module._extensions[".ts"] = function (module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = transpileModule(source, {
    compilerOptions: {
      module: 99, // ESNext
      target: 99,
      esModuleInterop: true,
      moduleResolution: 3,
      resolveJsonModule: true,
    },
    fileName: filename,
  });
  return module._compile(outputText, filename);
};

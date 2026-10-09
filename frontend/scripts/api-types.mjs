import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import openapiTS, { astToString } from "openapi-typescript";

const schema = execFileSync(
  "uv",
  [
    "run",
    "python",
    "-c",
    "import json; from backend.main import app; print(json.dumps(app.openapi()))",
  ],
  { cwd: "..", encoding: "utf8" },
);
const types = await openapiTS(JSON.parse(schema));
writeFileSync("src/api.generated.ts", astToString(types));

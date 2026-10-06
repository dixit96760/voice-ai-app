import * as fs from "node:fs";
import * as path from "node:path";

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let val = match[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

import { createAdminClient } from "../lib/supabase/admin";

async function checkBuckets() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("Error listing buckets:", error);
    process.exit(1);
  }
  console.log("Existing buckets in Supabase:");
  for (const b of data || []) {
    console.log(`- ${b.name} (id: ${b.id}, public: ${b.public})`);
  }

  const required = [
    "business-logos",
    "contact-imports",
    "call-recordings",
    "data-exports",
    "campaign-sources",
  ];
  const existingNames = new Set((data || []).map((b) => b.name));

  for (const req of required) {
    if (!existingNames.has(req)) {
      console.log(`Creating missing bucket: ${req}...`);
      const { data: created, error: createError } = await supabase.storage.createBucket(req, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
      if (createError) {
        console.error(`Failed to create bucket ${req}:`, createError);
      } else {
        console.log(`Successfully created bucket: ${req}`);
      }
    }
  }
}

checkBuckets().catch(console.error);

// Inlines ranker_core.js into search_template.xs. Usage: node build_xs.js <output .xs path>
const fs = require("fs"), path = require("path");
const core = fs.readFileSync(path.join(__dirname, "ranker_core.js"), "utf8").replace(/\r\n/g, "\n").trimEnd();
if (core.includes('"""')) throw new Error("core contains triple quotes");
if (/\$(var|input|env|auth)\b/.test(core)) throw new Error("core references Xano variables");
const indented = core.split("\n").map((l) => (l ? "            " + l : "")).join("\n");
const tpl = fs.readFileSync(path.join(__dirname, "search_template.xs"), "utf8").replace(/\r\n/g, "\n");
if (!tpl.includes("__RANKER_CORE__")) throw new Error("placeholder missing");
fs.writeFileSync(process.argv[2], tpl.replace("__RANKER_CORE__", () => indented));
console.log("wrote", process.argv[2], fs.statSync(process.argv[2]).size, "bytes");

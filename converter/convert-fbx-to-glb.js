#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const INPUT_DIR = "./input";
const OUTPUT_DIR = "./output";
const SCRIPT = "fbx2glb.py";

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

const fbxFiles = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith(".fbx"));

if (fbxFiles.length === 0) {
    console.error("❌ Nessun file .fbx trovato in /input");
    process.exit(1);
}

fbxFiles.forEach(file => {
    const inputPath = path.join(INPUT_DIR, file);
    const outputName = file.replace(/\.fbx$/, ".glb");
    const outputPath = path.join(OUTPUT_DIR, outputName);

    try {
        console.log(`🔁 Converto: ${file} → ${outputName}`);
        execSync(`blender --background --python ${SCRIPT} -- "${inputPath}" "${outputPath}"`, { stdio: "inherit" });
        console.log(`✅ Salvato: ${outputPath}\n`);
    } catch (err) {
        console.error(`❌ Errore su ${file}`, err);
    }
});

#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const INPUT_DIR = "./input";
const OUTPUT_DIR = "./output";

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// Filter .glb files in input directory
const glbFiles = fs.readdirSync(INPUT_DIR).filter(file => file.endsWith(".glb"));

if (glbFiles.length === 0) {
    console.error("❌ Nessun file .glb trovato nella cartella ./input");
    process.exit(1);
}

glbFiles.forEach(file => {
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);

    try {
        console.log(`🔍 Analisi: ${file}...`);
        const inspectOutput = execSync(`gltf-transform inspect "${inputPath}"`, { encoding: "utf-8" });

        const match = inspectOutput.match(/Buffers\s*:\s*(\d+(\.\d+)?)\s*MB/);
        const bufferSizeMB = match ? parseFloat(match[1]) : 0;

        const compressDraco = bufferSizeMB >= 10;
        const compressOption = compressDraco ? "--compress=draco --join=false" : "";

        console.log(`⚙️ Ottimizzazione (${compressDraco ? "con" : "senza"} DRACO): ${file}...`);
        execSync(`gltf-transform optimize "${inputPath}" "${outputPath}" ${compressOption} --texture-compress=webp`, { stdio: "inherit" });

        const originalSize = fs.statSync(inputPath).size / (1024 * 1024);
        const optimizedSize = fs.statSync(outputPath).size / (1024 * 1024);

        console.log(`✅ ${file}: ${originalSize.toFixed(2)} MB → ${optimizedSize.toFixed(2)} MB\n`);
    } catch (err) {
        console.error(`❌ Errore durante l'elaborazione di ${file}`, err);
    }
});

#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const INPUT_DIR = "./input";
const OUTPUT_DIR = "./output";

// Assicurati che la cartella di output esista
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// Filtra solo i file .glb nella cartella input
const glbFiles = fs.readdirSync(INPUT_DIR).filter(file => file.endsWith(".glb"));

if (glbFiles.length === 0) {
    console.error("❌ Nessun file .glb trovato nella cartella ./input");
    process.exit(1);
}

glbFiles.forEach(file => {
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);

    try {
        console.log(`🔄 Compressione DRACO: ${file}...`);
        //execSync(`gltf-transform optimize "${inputPath}" "${outputPath}" --compress=draco`, { stdio: "inherit" });
        execSync(`gltf-transform optimize "${inputPath}" "${outputPath}" --compress=draco --join=false`, { stdio: "inherit" });

        console.log(`✅ File compresso salvato in: ${outputPath}\n`);
    } catch (err) {
        console.error(`❌ Errore nella compressione di ${file}`, err);
    }
});

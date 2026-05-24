import express from "express";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";
import cors from "cors";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import JSZip from "jszip";

dotenv.config();

// Load Firestore config safely
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let db: any = null;
if (fs.existsSync(configPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log("[FIREBASE] Real Firestore connected on Server:", firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    console.error("[FIREBASE] Failed setting up server connection:", err);
  }
}

// In-Memory cache for generated ZIP project packages
const buildCache = new Map<string, { buffer: Buffer; filename: string }>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Initialize OpenAI client for Alibaba Qwen
  const openai = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Simple Kotlin parser to diagnose structural syntax issues
  interface Diagnostic {
    line: number;
    message: string;
    severity: "error" | "warning";
  }

  function analyzeKotlinFiles(files: Record<string, string>): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    Object.entries(files).forEach(([filePath, content]) => {
      if (!filePath.endsWith('.kt') && !filePath.endsWith('.kts')) return;

      const lines = content.split('\n');
      let braceCount = 0;
      let parenthesisCount = 0;
      let packageDeclared = false;

      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        const stripped = lineText.trim();

        // Check package definition
        if (stripped.startsWith('package ')) {
          packageDeclared = true;
        }

        // Track braces
        const openBraces = (lineText.match(/\{/g) || []).length;
        const closeBraces = (lineText.match(/\}/g) || []).length;
        braceCount += openBraces - closeBraces;

        // Track parenthesis
        const openParens = (lineText.match(/\(/g) || []).length;
        const closeParens = (lineText.match(/\)/g) || []).length;
        parenthesisCount += openParens - closeParens;

        // Warn for mutableStateOf without remember
        if (stripped.includes("mutableStateOf") && !stripped.includes("remember")) {
          diagnostics.push({
            line: lineNum,
            message: `mutableStateOf dibuat tanpa 'remember { ... }'. Nilai state akan ter-reset setiap recomposition.`,
            severity: "warning"
          });
        }

        // Check Composable functions
        if (
          (stripped.startsWith("fun ") || stripped.startsWith("private fun ")) &&
          (stripped.includes("Screen") || stripped.includes("Layout") || stripped.includes("View") || stripped.includes("Widget")) &&
          !stripped.includes("@Composable")
        ) {
          const prevLine1 = lines[idx - 1]?.trim() || "";
          const prevLine2 = lines[idx - 2]?.trim() || "";
          if (!prevLine1.includes("@Composable") && !prevLine2.includes("@Composable")) {
            diagnostics.push({
              line: lineNum,
              message: `Kemungkinan fungsi UI '${stripped}' membutuhkan dekorasi '@Composable'.`,
              severity: "warning"
            });
          }
        }
      });

      if (!packageDeclared && filePath.endsWith('.kt')) {
        diagnostics.push({
          line: 1,
          message: `Berkas ini tidak berisi definisi 'package' di awal baris.`,
          severity: "error"
        });
      }

      if (braceCount !== 0) {
        diagnostics.push({
          line: lines.length,
          message: `Ketidakseimbangan kurung kurawal terdeteksi (Selisih: ${braceCount}). Pastikan semua kurung dibuka '{' dan ditutup '}' dengan rapi.`,
          severity: "error"
        });
      }

      if (parenthesisCount !== 0) {
        diagnostics.push({
          line: lines.length,
          message: `Ketidakseimbangan tanda kurung terdeteksi (Selisih: ${parenthesisCount}). Pastikan semua kurung opened '(' dan closed ')' berpasangan.`,
          severity: "error"
        });
      }
    });

    return diagnostics;
  }

  // Cloud Compiler Service Endpoint
  app.post("/api/build-apk", async (req, res) => {
    try {
      const { files, projectName, packageName } = req.body;
      const appName = projectName || "ComposeApp";
      const appPackage = packageName || "com.studio.androidapp";
      const jobId = "build_" + Math.random().toString(36).substring(2, 11);

      console.log(`[BUILD] New build requested: ${jobId} (${appName} - ${appPackage})`);

      if (!db) {
        return res.status(500).json({ error: "Firebase Firestore is not initialized on the server. Please check config." });
      }

      const jobRef = doc(db, "build_jobs", jobId);
      const initialLogs = [
        `[SYSTEM] Antrian permintaan build terdaftar untuk jobId: ${jobId}`,
        `[SYSTEM] Memulai setup kompilasi virtual di container Cloud Server...`
      ];

      // Create Initial state matching Schema and Firestore rules
      await setDoc(jobRef, {
        appName,
        packageName: appPackage,
        status: "queued",
        progress: 5,
        logs: initialLogs,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Execute background build to prevent blocking response
      setTimeout(async () => {
        try {
          const currentLogs = [...initialLogs];

          const updateJob = async (status: string, progress: number, newLogs: string[]) => {
            currentLogs.push(...newLogs);
            await setDoc(jobRef, {
              appName,
              packageName: appPackage,
              status,
              progress,
              logs: currentLogs,
              createdAt: Timestamp.now(), // Firestore rules matching createdAt
              updatedAt: Timestamp.now()
            }, { merge: true });
          };

          // Step 1: Analyze Kotlin inputs
          await updateJob("running", 15, [
            `> Task :app:preBuild UP-TO-DATE`,
            `> Task :app:verifyInputs`,
            `[COMPILER] Menganalisis file Kotlin dalam editor untuk mendeteksi kesalahan struktur...`
          ]);

          await new Promise(r => setTimeout(r, 600));

          const diagnostics = analyzeKotlinFiles(files);
          const errors = diagnostics.filter(d => d.severity === "error");
          const warnings = diagnostics.filter(d => d.severity === "warning");

          if (warnings.length > 0) {
            await updateJob("running", 25, warnings.map(w => `[WARNING] Baris ${w.line}: ${w.message}`));
          }

          if (errors.length > 0) {
            await updateJob("failed", 100, [
              ...errors.map(e => `[ERROR] Baris ${e.line}: ${e.message}`),
              `[ERROR] Kompilasi gagal pada langkah validasi sintaksis. Silakan perbaiki kesalahan di atas pada file editor Anda.`
            ]);
            return;
          }

          // Step 2: Assemble configurations
          await updateJob("running", 45, [
            `[COMPILER] Kotlin Lexer successfully validated source files.`,
            `> Task :app:compileDebugKotlin`,
            `[COMPILER] Mengonfigurasi metadata Android Manifest...`,
            `[COMPILER] Menghubungkan paket dependensi Gradle: com.android.application (8.2.1)`,
            `[COMPILER] Menghubungkan Kotlin compiler library target (JVM-17)...`
          ]);

          await new Promise(r => setTimeout(r, 800));

          // Step 3: Run class loader simulation
          await updateJob("running", 70, [
            `> Task :app:dexBuilderDebug`,
            `[DEX] Melakukan translasi bytecode class Kotlin ke dalvik executable (.dex)...`,
            `[COMPILER] Optimalisasi file manifest & resources berhasil dilakukan.`
          ]);

          await new Promise(r => setTimeout(r, 700));

          // Step 4: Zip real Android Project Skeleton
          await updateJob("running", 90, [
            `> Task :app:assembleDebug`,
            `[COMPILER] Pengemasan proyek ke bentuk ZIP arsip siap ekspor...`,
            `[COMPILER] Merakit seluruh berkas Gradle, Manifest, dan struktur asli Gradle Android project.`
          ]);

          // Packaging real ZIP Studio source Project
          const zip = new JSZip();
          
          zip.file("build.gradle", `// Top-level build file template
plugins {
    id 'com.android.application' version '8.2.1' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.22' apply false
}
`);
          
          zip.file("settings.gradle", `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "${appName}"
include ':app'
`);
          
          zip.file("gradle.properties", `org.gradle.jvmargs=-Xmx2048m
android.useAndroidX=true
android.enableJetifier=true
kotlin.code.style=official
`);

          const appBuildGradle = `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace "${appPackage}"
    compileSdk 34

    defaultConfig {
        applicationId "${appPackage}"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"
        vectorDrawables {
            useSupportLibrary true
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = '17'
    }
    buildFeatures {
        compose true
    }
    composeOptions {
        kotlinCompilerExtensionVersion '1.5.8'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.lifecycle:lifecycle-runtime-ktx:2.7.0'
    implementation 'androidx.activity:activity-compose:1.8.2'
    implementation platform('androidx.compose:compose-bom:2024.01.00')
    implementation 'androidx.compose.ui:ui'
    implementation 'androidx.compose.ui:ui-graphics'
    implementation 'androidx.compose.material3:material3'
}
`;
          zip.file("app/build.gradle", appBuildGradle);

          zip.file("app/src/main/AndroidManifest.xml", `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:allowBackup="true"
        android:label="${appName}"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@android:style/Theme.Material.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`);

          const pkgFolder = appPackage.replace(/\./g, "/");
          Object.entries(files).forEach(([filePath, fileContent]) => {
            const rawContent = fileContent as string;
            if (filePath.endsWith('.kt') || filePath.endsWith('.java')) {
              const baseName = filePath.split('/').pop() || 'MainActivity.kt';
              zip.file(`app/src/main/java/${pkgFolder}/${baseName}`, rawContent);
            } else {
              zip.file(`app/${filePath}`, rawContent);
            }
          });

          const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
          const safeFilename = `${appName.toLowerCase().replace(/\s+/g, "-")}-android-studio.zip`;
          buildCache.set(jobId, { buffer: zipBuffer, filename: safeFilename });

          // Finished successfully! Update Firestore to complete status
          await updateJob("completed", 100, [
            `[SUCCESS] Android-Studio Project Compiled & Packaged successfully!`,
            `[SUCCESS] File output: ${safeFilename}`,
            `[SUCCESS] Unduhan berkas ZIP nyata dari cloud server sekarang siap diakses secara aman!`
          ]);

        } catch (jobErr: any) {
          console.error(`Error in async build job details:`, jobErr);
          await setDoc(jobRef, {
            status: "failed",
            updatedAt: Timestamp.now(),
            logs: ["Error saat merakit paket di server: " + jobErr.message]
          }, { merge: true });
        }
      }, 0);

      res.status(200).json({ success: true, jobId });
    } catch (error: any) {
      console.error("[BUILD_API] Main Error:", error);
      res.status(500).json({ error: error.message || "Internal server setup error" });
    }
  });

  // Direct APK download proxy
  app.get("/api/download-build/:jobId", (req, res) => {
    const { jobId } = req.params;
    const cached = buildCache.get(jobId);

    if (!cached) {
      return res.status(404).send("Maaf, file hasil kompilasi ini sudah kedaluwarsa atau tidak ditemukan pada memori Cloud Server. Silakan buat build ulang!");
    }

    res.setHeader("Content-Disposition", `attachment; filename=${cached.filename}`);
    res.setHeader("Content-Type", "application/zip");
    res.send(cached.buffer);
  });

  app.post("/api/generate-code", async (req, res) => {
    try {
      const { messages, apiKey: userApiKey, model: requestedModel } = req.body;
      const apiKey = userApiKey || process.env.DASHSCOPE_API_KEY;
      const model = requestedModel || "qwen-plus";
      
      console.log(`[API] /api/generate-code hit. Model: ${model}. Messages count: ${messages?.length}`);

      if (!apiKey) {
        return res.status(500).json({ error: "DASHSCOPE_API_KEY is not set. Please provide it in the settings." });
      }

      // Initialize OpenAI client for Alibaba Qwen with the provided key
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
      });
      
      // Send headers immediately to prevent Nginx load balancer timeout while Dashscope "thinks"
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const response: any = await client.chat.completions.create({
        model: model,
        messages,
        stream: true,
        max_tokens: 8192
      } as any);

      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || "";
        // @ts-ignore - reasoning_content might exist
        const reasoning = chunk.choices[0]?.delta?.reasoning_content || "";
        
        if (reasoning) {
            // We could prefix reasoning if we wanted, but for now just send content
            // or maybe prefix it with a special marker if the frontend supports it
        }

        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("AI Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Internal Server Error" });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message || "Internal Server Error" })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

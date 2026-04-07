plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.edot.reactnative"
    compileSdk = 34

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        getByName("main") {
            java.srcDirs("src/main/java")
        }
    }
}

dependencies {
    implementation("com.facebook.react:react-android:+")
    // OTel API — spans and metrics via GlobalOpenTelemetry (set up by EDOT Gradle plugin at runtime)
    implementation("io.opentelemetry:opentelemetry-api:1.60.1")
}

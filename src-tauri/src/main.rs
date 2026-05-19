// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::path::PathBuf;


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleSegment {
    pub index: u32,
    pub start: f64,
    pub end: f64,
    pub original_text: String,
    pub translated_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub segments: Vec<SubtitleSegment>,
    pub detected_language: String,
    pub processing_duration: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
}

#[tauri::command]
async fn greet(name: &str) -> Result<String, String> {
    Ok(format!("Hello, {}! You've been greeted from Rust!", name))
}

#[tauri::command]
async fn select_video_file() -> Result<VideoFileInfo, String> {
    let file_handle = rfd::FileDialog::new()
        .add_filter("Video Files", &["mp4", "mkv", "avi", "mov", "flv", "wmv"])
        .pick_file()
        .ok_or("No file selected".to_string())?;

    let path = file_handle.to_string_lossy().to_string();
    let name = file_handle
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let size = fs::metadata(&file_handle)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(VideoFileInfo { path, name, size })
}

#[tauri::command]
async fn select_models_directory() -> Result<String, String> {
    let dir = rfd::FileDialog::new()
        .set_directory(".")
        .pick_folder()
        .ok_or("No directory selected".to_string())?;

    Ok(dir.to_string_lossy().to_string())
}

fn find_model_files(path: &Path, status: &mut HashMap<String, PathBuf>, safetensors_found: &mut bool) {
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let file_type = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };
            
            if file_type.is_dir() {
                find_model_files(&entry.path(), status, safetensors_found);
            } else if file_type.is_file() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.ends_with(".bin") {
                    status.insert(file_name, entry.path());
                } else if file_name.ends_with(".safetensors") {
                    *safetensors_found = true;
                }
            }
        }
    }
}

#[tauri::command]
async fn check_model_files(models_path: &str, _models: Vec<String>) -> Result<HashMap<String, String>, String> {
    let mut status = HashMap::new();
    let path = PathBuf::from(models_path);
    let mut safetensors_found = false;

    if path.exists() {
        if path.is_dir() {
            let mut files = HashMap::new();
            find_model_files(&path, &mut files, &mut safetensors_found);
            
            let files_is_empty = files.is_empty();
            
            for (name, full_path) in files {
                status.insert(name, full_path.to_string_lossy().to_string());
            }
            
            if safetensors_found && files_is_empty {
                status.insert("_safetensors_detected".to_string(), "true".to_string());
            }
        } else if path.is_file() && path.extension().map_or(false, |ext| ext == "bin") {
            let file_name = path.file_name().unwrap().to_string_lossy().to_string();
            status.insert(file_name, path.to_string_lossy().to_string());
        }
    }

    Ok(status)
}

#[tauri::command]
async fn extract_audio(video_path: &str) -> Result<String, String> {
    println!("extract_audio called with path: {}", video_path);
    
    let input_path = PathBuf::from(video_path);
    
    if !input_path.exists() {
        return Err(format!("Input file does not exist: {}", video_path));
    }
    
    let file_stem = input_path.file_stem()
        .ok_or("Could not get file stem")?
        .to_string_lossy();
    
    let project_root = match std::env::current_dir() {
        Ok(dir) => dir.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| PathBuf::from(".")),
        Err(_) => PathBuf::from("."),
    };
    
    let temp_dir = project_root.join("temp");
    match std::fs::create_dir_all(&temp_dir) {
        Ok(_) => println!("Temp directory created at: {:?}", temp_dir),
        Err(e) => {
            println!("Warning: could not create temp directory: {}", e);
        }
    }
    
    let output_path = temp_dir.join(format!("{}.wav", file_stem));
    
    println!("Output path: {:?}", output_path);

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(300),
        tokio::process::Command::new("ffmpeg")
            .args([
                "-i",
                video_path,
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                "-y",
                output_path.to_str().ok_or("Invalid output path")?,
            ])
            .output()
    ).await;

    match output {
        Ok(Ok(output)) => {
            if output.status.success() {
                let result = output_path.to_string_lossy().to_string();
                println!("Audio extraction successful: {}", result);
                Ok(result)
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                let msg = format!("FFmpeg failed: {}", error);
                println!("{}", msg);
                Err(msg)
            }
        }
        Ok(Err(e)) => {
            let msg = format!("Failed to execute FFmpeg: {}", e);
            println!("{}", msg);
            Err(msg)
        }
        Err(_) => {
            let msg = "FFmpeg execution timed out".to_string();
            println!("{}", msg);
            Err(msg)
        }
    }
}

#[tauri::command]
async fn get_audio_duration(audio_path: &str) -> Result<f64, String> {
    let output = tokio::process::Command::new("ffprobe")
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path
        ])
        .output()
        .await;

    match output {
        Ok(output) => {
            if output.status.success() {
                let duration_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let duration = duration_str.parse::<f64>()
                    .map_err(|_| "Failed to parse duration".to_string())?;
                Ok(duration)
            } else {
                Err("Failed to get audio duration".to_string())
            }
        }
        Err(e) => Err(format!("Failed to execute ffprobe: {}", e))
    }
}

#[tauri::command]
async fn transcribe_audio(
    audio_path: &str,
    model: &str,
    models_path: Option<&str>,
    _use_cloud: bool,
    _api_key: Option<String>,
) -> Result<TranscriptionResult, String> {
    let start_time = std::time::Instant::now();
    
    let model_path = match models_path {
        Some(path) => {
            let mut p = PathBuf::from(path);
            p.push(model);
            p.to_string_lossy().to_string()
        }
        None => {
            let mut p = PathBuf::from("./models");
            p.push(model);
            p.to_string_lossy().to_string()
        }
    };

    if !PathBuf::from(&model_path).exists() {
        return Err(format!("Model file not found: {}", model_path));
    }

    let ctx = whisper_rs::WhisperContext::new_with_params(
        &model_path,
        whisper_rs::WhisperContextParameters::default()
    ).map_err(|e| format!("Failed to load Whisper model: {}", e))?;

    let mut params = whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("auto"));
    params.set_translate(false);
    params.set_print_progress(true);

    let mut state = ctx
        .create_state()
        .map_err(|e| format!("Failed to create Whisper state: {}", e))?;

    let audio_data = fs::read(audio_path).map_err(|e| format!("Failed to read audio file: {}", e))?;
    
    let audio_f32: Vec<f32> = audio_data
        .chunks(2)
        .map(|chunk| {
            if chunk.len() == 2 {
                i16::from_le_bytes([chunk[0], chunk[1]]) as f32 / 32768.0
            } else {
                0.0
            }
        })
        .collect();
    
    state
        .full(params, &audio_f32)
        .map_err(|e| format!("Failed to process audio: {}", e))?;

    let detected_language = match state.full_lang_id_from_state() {
        Ok(lang_id) => {
            match whisper_rs::get_lang_str(lang_id) {
                Some(lang) => lang.to_string(),
                None => "auto".to_string(),
            }
        }
        Err(_) => "auto".to_string(),
    };

    let num_segments = state.full_n_segments().map_err(|e| format!("Failed to get segments: {}", e))?;
    let mut segments = Vec::new();

    for i in 0..num_segments {
        let start = state.full_get_segment_t0(i).map_err(|e| format!("Failed to get segment start: {}", e))? as f64 / 100.0;
        let end = state.full_get_segment_t1(i).map_err(|e| format!("Failed to get segment end: {}", e))? as f64 / 100.0;
        let text = state
            .full_get_segment_text(i)
            .map_err(|e| format!("Failed to get segment text: {}", e))?
            .trim()
            .to_string();

        if !text.is_empty() {
            segments.push(SubtitleSegment {
                index: i as u32,
                start,
                end,
                original_text: text,
                translated_text: None,
            });
        }
    }

    let processing_duration = start_time.elapsed().as_secs_f64();

    Ok(TranscriptionResult {
        segments,
        detected_language,
        processing_duration,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIChatRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    temperature: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAIChatResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Debug, Clone, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[tauri::command]
async fn translate_subtitle(
    segments: Vec<SubtitleSegment>,
    provider: &str,
    api_key: &str,
    model: &str,
    from_lang: &str,
    to_lang: &str,
    system_prompt: &str,
) -> Result<Vec<SubtitleSegment>, String> {
    let client = reqwest::Client::new();
    let mut translated_segments = Vec::new();
    let batch_size = 50;
    let context_size = 10;

    for (batch_idx, chunk) in segments.chunks(batch_size).enumerate() {
        let start_idx = batch_idx * batch_size;
        let end_idx = start_idx + chunk.len();
        
        let context_start = if start_idx > context_size { start_idx - context_size } else { 0 };
        let context_end = if end_idx + context_size < segments.len() { end_idx + context_size } else { segments.len() };
        
        let mut context_text = String::new();
        if context_start < start_idx {
            context_text.push_str("【上文参考】\n");
            for seg in &segments[context_start..start_idx] {
                context_text.push_str(&format!("[{}] {}\n", seg.index, seg.original_text));
            }
            context_text.push_str("\n");
        }
        
        let mut target_text = String::new();
        for seg in chunk {
            target_text.push_str(&format!("[{}] {}\n---\n", seg.index, seg.original_text));
        }
        target_text.pop();
        target_text.pop();
        target_text.pop();
        
        let mut following_context = String::new();
        if context_end > end_idx {
            following_context.push_str("\n【下文参考】\n");
            for seg in &segments[end_idx..context_end] {
                following_context.push_str(&format!("[{}] {}\n", seg.index, seg.original_text));
            }
        }

        let user_prompt = format!(
            "请将以下{}文本翻译成{}。\n\n翻译规则：\n1. 保持原文的[数字]序号前缀和---分隔符格式\n2. 参考上下文语境给出合适的翻译结果，确保语义连贯\n3. 只翻译【待翻译内容】部分，不要翻译上下文参考部分\n4. 翻译结果保持与原文相同的行数和格式\n\n【上文参考】（用于理解语境）\n{}\n\n【待翻译内容】\n{}\n\n【下文参考】（用于理解语境）\n{}",
            from_lang, to_lang, 
            if context_start < start_idx { &context_text[4..] } else { "" },
            target_text,
            if context_end > end_idx { &following_context[4..] } else { "" }
        );

        let request_body = OpenAIChatRequest {
            model: model.to_string(),
            messages: vec![
                OpenAIMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                OpenAIMessage {
                    role: "user".to_string(),
                    content: user_prompt,
                },
            ],
            temperature: 0.3,
        };

        let response = match provider {
            "openai" => {
                client
                    .post("https://api.openai.com/v1/chat/completions")
                    .header("Authorization", format!("Bearer {}", api_key))
                    .json(&request_body)
                    .send()
                    .await
                    .map_err(|e| format!("API request failed: {}", e))?
            }
            "minimax" => {
                client
                    .post("https://api.minimaxi.com/v1/chat/completions")
                    .header("Authorization", format!("Bearer {}", api_key))
                    .json(&request_body)
                    .send()
                    .await
                    .map_err(|e| format!("API request failed: {}", e))?
            }
            _ => {
                client
                    .post("https://api.deepseek.com/v1/chat/completions")
                    .header("Authorization", format!("Bearer {}", api_key))
                    .json(&request_body)
                    .send()
                    .await
                    .map_err(|e| format!("API request failed: {}", e))?
            }
        };

        let response_text: OpenAIChatResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse API response: {}", e))?;

        let translated_text = response_text
            .choices
            .first()
            .and_then(|c| Some(c.message.content.clone()))
            .unwrap_or_default();

        let translations: Vec<&str> = translated_text.split("---").collect();

        for (i, seg) in chunk.iter().enumerate() {
            let trans = translations.get(i).unwrap_or(&"").trim();
            let trans = trans
                .splitn(2, ']')
                .nth(1)
                .unwrap_or(trans)
                .trim()
                .to_string();

            translated_segments.push(SubtitleSegment {
                index: seg.index,
                start: seg.start,
                end: seg.end,
                original_text: seg.original_text.clone(),
                translated_text: Some(if trans.is_empty() {
                    seg.original_text.clone()
                } else {
                    trans
                }),
            });
        }
    }

    Ok(translated_segments)
}

#[tauri::command]
async fn test_api_connection(
    provider: &str,
    apikey: &str,
) -> Result<bool, String> {
    let client = reqwest::Client::new();

    println!("Testing API connection for provider: {}", provider);

    let result = match provider {
        "minimax" => {
            let url = "https://api.minimaxi.com/v1/chat/completions";
            println!("URL: {}", url);
            
            let request_body = OpenAIChatRequest {
                model: "MiniMax-M2.7".to_string(),
                messages: vec![
                    OpenAIMessage {
                        role: "system".to_string(),
                        content: "你是一个测试助手。".to_string(),
                    },
                    OpenAIMessage {
                        role: "user".to_string(),
                        content: "请回复 'OK'".to_string(),
                    },
                ],
                temperature: 0.0,
            };

            let response = client
                .post(url)
                .header("Authorization", format!("Bearer {}", apikey))
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
                .await;

            match response {
                Ok(res) => {
                    let status = res.status();
                    println!("API response status: {}", status);
                    let text = res.text().await.unwrap_or_default();
                    println!("API response body: {}", text);
                    status.is_success()
                }
                Err(e) => {
                    println!("API request failed: {}", e);
                    false
                }
            }
        }
        "deepseek" => {
            let url = "https://api.deepseek.com/v1/chat/completions";
            println!("URL: {}", url);
            
            let request_body = OpenAIChatRequest {
                model: "deepseek-chat".to_string(),
                messages: vec![
                    OpenAIMessage {
                        role: "system".to_string(),
                        content: "你是一个测试助手。".to_string(),
                    },
                    OpenAIMessage {
                        role: "user".to_string(),
                        content: "请回复 'OK'".to_string(),
                    },
                ],
                temperature: 0.0,
            };

            let response = client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key))
                .json(&request_body)
                .send()
                .await;

            match response {
                Ok(res) => {
                    let status = res.status();
                    println!("API response status: {}", status);
                    let text = res.text().await.unwrap_or_default();
                    println!("API response body: {}", text);
                    status.is_success()
                }
                Err(e) => {
                    println!("API request failed: {}", e);
                    false
                }
            }
        }
        _ => {
            let url = "https://api.openai.com/v1/chat/completions";
            println!("URL: {}", url);
            
            let request_body = OpenAIChatRequest {
                model: "gpt-4o-mini".to_string(),
                messages: vec![
                    OpenAIMessage {
                        role: "system".to_string(),
                        content: "你是一个测试助手。".to_string(),
                    },
                    OpenAIMessage {
                        role: "user".to_string(),
                        content: "请回复 'OK'".to_string(),
                    },
                ],
                temperature: 0.0,
            };

            let response = client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key))
                .json(&request_body)
                .send()
                .await;

            match response {
                Ok(res) => {
                    let status = res.status();
                    println!("API response status: {}", status);
                    let text = res.text().await.unwrap_or_default();
                    println!("API response body: {}", text);
                    status.is_success()
                }
                Err(e) => {
                    println!("API request failed: {}", e);
                    false
                }
            }
        }
    };

    Ok(result)
}

#[tauri::command]
async fn export_srt(
    segments: Vec<SubtitleSegment>,
    output_path: &str,
    mode: &str,
) -> Result<(), String> {
    let mut content = String::new();

    for seg in &segments {
        content.push_str(&format!("{}\n", seg.index + 1));

        let format_time = |t: f64| {
            let hours = (t / 3600.0) as u32;
            let minutes = ((t % 3600.0) / 60.0) as u32;
            let seconds = (t % 60.0) as u32;
            let millis = ((t % 1.0) * 1000.0) as u32;
            format!(
                "{:02}:{:02}:{:02},{:03}",
                hours, minutes, seconds, millis
            )
        };

        content.push_str(&format!(
            "{} --> {}\n",
            format_time(seg.start),
            format_time(seg.end)
        ));

        match mode {
            "original" => {
                content.push_str(&seg.original_text);
            }
            "translated" => {
                content.push_str(seg.translated_text.as_ref().unwrap_or(&seg.original_text));
            }
            "bilingual-top-bottom" => {
                content.push_str(&seg.original_text);
                content.push('\n');
                content.push_str(seg.translated_text.as_ref().unwrap_or(&seg.original_text));
            }
            "bilingual-left-right" => {
                content.push_str(&format!(
                    "{} | {}",
                    seg.original_text,
                    seg.translated_text.as_ref().unwrap_or(&seg.original_text)
                ));
            }
            _ => {
                content.push_str(seg.translated_text.as_ref().unwrap_or(&seg.original_text));
            }
        }

        content.push_str("\n\n");
    }

    fs::write(output_path, content).map_err(|e| format!("Failed to write SRT file: {}", e))?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            select_video_file,
            select_models_directory,
            check_model_files,
            extract_audio,
            get_audio_duration,
            transcribe_audio,
            translate_subtitle,
            test_api_connection,
            export_srt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

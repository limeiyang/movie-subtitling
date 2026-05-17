// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleSegment {
    pub index: u32,
    pub start: f64,
    pub end: f64,
    pub original_text: String,
    pub translated_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
}

#[tauri::command]
async fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
async fn extract_audio(video_path: &str) -> Result<String, String> {
    let input_path = PathBuf::from(video_path);
    let mut output_path = input_path.clone();
    output_path.set_extension("wav");

    let output = Command::new("ffmpeg")
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
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if output.status.success() {
        Ok(output_path.to_string_lossy().to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg failed: {}", error))
    }
}

#[tauri::command]
async fn transcribe_audio(
    audio_path: &str,
    model: &str,
    use_cloud: bool,
    api_key: Option<String>,
) -> Result<Vec<SubtitleSegment>, String> {
    // 使用本地 Whisper 模型
    let ctx = whisper_rs::WhisperContext::new(&format!("./models/ggml-{}.bin", model))
        .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

    let mut params = whisper_rs::FullParams::new();
    params.set_language(Some("auto"));
    params.set_translate(false);
    params.set_print_progress(true);

    let mut state = ctx
        .create_state()
        .map_err(|e| format!("Failed to create Whisper state: {}", e))?;

    state
        .process_audio_file(audio_path, params)
        .map_err(|e| format!("Failed to process audio: {}", e))?;

    let num_segments = state.full_n_segments();
    let mut segments = Vec::new();

    for i in 0..num_segments {
        let start = state.full_get_segment_t0(i) as f64 / 100.0;
        let end = state.full_get_segment_t1(i) as f64 / 100.0;
        let text = state
            .full_get_segment_text(i)
            .unwrap_or_default()
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

    Ok(segments)
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

    // 批量处理，每次10条
    for chunk in segments.chunks(10) {
        let combined_text: Vec<String> = chunk
            .iter()
            .map(|s| format!("[{}] {}", s.index, s.original_text))
            .collect();
        let combined_text = combined_text.join("\n---\n");

        let user_prompt = format!(
            "Translate the following {} text to {}. Keep the same format with [number] prefix and --- separators:\n\n{}",
            from_lang, to_lang, combined_text
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
                    .post("https://api.minimax.chat/v1/text/chatcompletion_pro")
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
            extract_audio,
            transcribe_audio,
            translate_subtitle,
            export_srt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use tauri::Emitter;

mod subtitle;
use subtitle::cleaners::CleanupProcessor;
use subtitle::content::ContentProcessor;
use subtitle::pipeline::Pipeline;
use subtitle::quality::QualityProcessor;
use subtitle::rules::PostProcessConfig;
use subtitle::timing::TimingProcessor;

fn create_default_pipeline() -> Pipeline {
    let config = PostProcessConfig::default();
    
    Pipeline::builder()
        .with_config(config)
        .add_processor(CleanupProcessor)
        .add_processor(TimingProcessor)
        .add_processor(ContentProcessor)
        .add_processor(QualityProcessor)
        .build()
}

fn postprocess_segments(segments: Vec<SubtitleSegment>) -> Vec<SubtitleSegment> {
    segments
}

fn decode_wav(data: &[u8]) -> Result<Vec<f32>, String> {
    println!("decode_wav: 输入数据大小 = {} bytes", data.len());
    
    if data.len() < 44 {
        return Err("WAV file too short".to_string());
    }
    
    if &data[0..4] != b"RIFF" {
        return Err("Not a RIFF file".to_string());
    }
    
    if &data[8..16] != b"WAVEfmt " {
        return Err("Not a WAVE file".to_string());
    }
    
    let audio_format = u16::from_le_bytes(data[20..22].try_into().unwrap());
    println!("decode_wav: audio_format = {} (1=PCM, 3=IEEE float)", audio_format);
    
    if audio_format != 1 && audio_format != 3 {
        return Err(format!("Unsupported audio format: {} (only PCM=1 and IEEE float=3 supported)", audio_format));
    }
    
    let channels = u16::from_le_bytes(data[22..24].try_into().unwrap());
    let sample_rate = u32::from_le_bytes(data[24..28].try_into().unwrap());
    let byte_rate = u32::from_le_bytes(data[28..32].try_into().unwrap());
    let block_align = u16::from_le_bytes(data[32..34].try_into().unwrap());
    let bits_per_sample = u16::from_le_bytes(data[34..36].try_into().unwrap());
    
    println!("decode_wav: channels = {}, sample_rate = {}, bits_per_sample = {}", channels, sample_rate, bits_per_sample);
    
    // 查找 data chunk (WAV 文件格式：RIFF header + fmt chunk + data chunk)
    // data chunk 可能在标准偏移量 44，也可能包含额外的 chunk
    let data_start = if data.len() >= 44 {
        // 假设标准格式，data 在偏移量 44
        44
    } else {
        return Err("WAV file too short".to_string());
    };
    
    // 获取 WAV header 中声明的 data_size
    let declared_data_size = if data.len() > data_start + 4 {
        u32::from_le_bytes(data[data_start - 4..data_start].try_into().unwrap()) as usize
    } else {
        0
    };
    
    // 计算实际可用的数据大小（文件总大小 - data chunk header）
    let available_data = data.len() - data_start;
    
    // 使用 header 中声明的大小，但如果它太小（小于文件实际剩余大小的一半），使用实际剩余大小
    let data_size = if declared_data_size > available_data / 2 && declared_data_size > 0 {
        declared_data_size
    } else {
        println!("decode_wav: header data_size ({}) 太小，使用实际剩余数据 ({})", declared_data_size, available_data);
        available_data
    };
    
    println!("decode_wav: data_start = {}, data_size = {} (declared: {}, available: {})", data_start, data_size, declared_data_size, available_data);
    
    let audio_data = &data[data_start..std::cmp::min(data_start + data_size, data.len())];
    let bytes_per_sample = (bits_per_sample / 8) as usize;
    let expected_samples = audio_data.len() / bytes_per_sample;
    println!("decode_wav: 预期采样数 = {}", expected_samples);
    
    let mut samples = Vec::with_capacity(expected_samples);
    
    match bits_per_sample {
        16 => {
            for i in (0..audio_data.len()).step_by(2) {
                let sample = i16::from_le_bytes(audio_data[i..i+2].try_into().unwrap());
                samples.push(sample as f32 / 32768.0);
            }
        }
        32 => {
            if audio_format == 3 {
                // IEEE float
                for i in (0..audio_data.len()).step_by(4) {
                    let bits = u32::from_le_bytes(audio_data[i..i+4].try_into().unwrap());
                    let sample = f32::from_bits(bits);
                    samples.push(sample);
                }
            } else {
                // 32-bit PCM
                for i in (0..audio_data.len()).step_by(4) {
                    let sample = i32::from_le_bytes(audio_data[i..i+4].try_into().unwrap());
                    samples.push(sample as f32 / 2147483648.0);
                }
            }
        }
        8 => {
            for &byte in audio_data {
                let sample = byte as i8;
                samples.push(sample as f32 / 128.0);
            }
        }
        _ => {
            return Err(format!("Unsupported bit depth: {}", bits_per_sample));
        }
    }
    
    println!("decode_wav: 解码后采样数 = {} (channels={})", samples.len(), channels);
    
    if channels == 2 {
        let mut mono_samples = Vec::with_capacity(samples.len() / 2);
        for i in (0..samples.len()).step_by(2) {
            mono_samples.push((samples[i] + samples[i + 1]) / 2.0);
        }
        println!("decode_wav: 转换为单声道后采样数 = {}", mono_samples.len());
        Ok(mono_samples)
    } else {
        Ok(samples)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processing_duration: Option<f64>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TranslationBatch {
    translations: Vec<TranslationItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TranslationItem {
    index: usize,
    text: String,
}

async fn translate_single_batch(
    app: tauri::AppHandle,
    client: reqwest::Client,
    segments: &Vec<SubtitleSegment>,
    chunk: &[SubtitleSegment],
    batch_idx: usize,
    batch_size: usize,
    total_batches: usize,
    total_segments_count: usize,
    provider: &str,
    apikey: &str,
    model: &str,
    fromLang: &str,
    toLang: &str,
    systemPrompt: &str,
    context_size: usize,
) -> Result<Vec<SubtitleSegment>, String> {
    let start_idx = batch_idx * batch_size;
    let end_idx = start_idx + chunk.len();
    let progress = ((batch_idx + 1) as f64 / total_batches as f64) * 100.0;
    
    let _ = app.emit("translation-progress", serde_json::json!({
        "batchIndex": batch_idx + 1,
        "totalBatches": total_batches,
        "progress": progress,
        "message": format!("处理批次 {}/{} (字幕 {} - {})", batch_idx + 1, total_batches, start_idx + 1, end_idx)
    }));
    
    println!("[INFO] 处理批次 {}/{} (字幕 {} - {}), 进度: {:.1}%", 
             batch_idx + 1, total_batches, start_idx + 1, end_idx, progress);
    
    let context_start = if start_idx > context_size { start_idx - context_size } else { 0 };
    let context_end = if end_idx + context_size < segments.len() { end_idx + context_size } else { segments.len() };
    
    let mut context_text = String::new();
    if context_start < start_idx {
        for seg in &segments[context_start..start_idx] {
            context_text.push_str(&format!("[{}] {}\n", seg.index, seg.original_text));
        }
    }
    
    let mut translation_items = Vec::new();
    for seg in chunk {
        translation_items.push(TranslationItem {
            index: seg.index as usize,
            text: seg.original_text.clone(),
        });
    }
    
    let mut following_context = String::new();
    if context_end > end_idx {
        for seg in &segments[end_idx..context_end] {
            following_context.push_str(&format!("[{}] {}\n", seg.index, seg.original_text));
        }
    }

    let input_json = serde_json::to_string(&TranslationBatch {
        translations: translation_items,
    }).unwrap();

    let user_prompt = format!(
        "请将以下{}文本翻译成{}。\n\n翻译规则：\n1. 严格以JSON格式返回翻译结果，格式与输入完全相同\n2. 只修改text字段为翻译结果，保持index字段不变\n3. 给出的原始字幕可能是语音转换的文字，可能存在一些识别错误，请参考上下文语境给出合适的翻译结果，确保语义连贯\n4. 只翻译【待翻译内容】部分，不要翻译上下文参考部分\n5. 确保返回的是纯JSON，不要有任何额外的文字说明\n\n返回格式示例：\n{{\n  \"translations\": [\n    {{\n      \"index\": 0,\n      \"text\": \"翻译结果\"\n    }}\n  ]\n}}\n\n【上文参考】（用于理解语境）\n{}{}\n\n【待翻译内容】\n{}\n\n【下文参考】（用于理解语境）\n{}{}",
        fromLang, toLang, 
        if !context_text.is_empty() { "【上文参考】\n" } else { "" },
        context_text,
        input_json,
        if !following_context.is_empty() { "【下文参考】\n" } else { "" },
        following_context
    );

    println!("");
    println!("========== [DEBUG] 请求输入 ==========");
    println!("[DEBUG] 批次 {}/{}", batch_idx + 1, total_batches);
    println!("[DEBUG] System Prompt: {}", systemPrompt);
    println!("=========================================");

    let request_body = OpenAIChatRequest {
        model: model.to_string(),
        messages: vec![
            OpenAIMessage {
                role: "system".to_string(),
                content: systemPrompt.to_string(),
            },
            OpenAIMessage {
                role: "user".to_string(),
                content: user_prompt,
            },
        ],
        temperature: 0.3,
    };

    let url = match provider {
        "openai" => "https://api.openai.com/v1/chat/completions",
        "minimax" => "https://api.minimaxi.com/v1/chat/completions",
        _ => "https://api.deepseek.com/v1/chat/completions",
    };

    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", apikey))
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status_code = response.status();
    println!("[DEBUG] HTTP 状态码: {}", status_code);

    let response_body = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    let openai_response: OpenAIResponse = serde_json::from_str(&response_body)
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let full_response = openai_response
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();
    
    println!("");
    println!("========== [DEBUG] 响应输出 ==========");
    println!("[DEBUG] 批次 {}/{}", batch_idx + 1, total_batches);
    println!("[DEBUG] 原始响应 (前1000字符):");
    println!("{}", full_response.chars().take(1000).collect::<String>());
    println!("=========================================");

    let json_start = full_response.find('{').unwrap_or(0);
    let json_end = match full_response.rfind('}') {
        Some(idx) => idx + 1,
        None => full_response.len(),
    };
    let json_end = json_end.min(full_response.len());
    let json_str = &full_response[json_start..json_end];
    
    println!("[DEBUG] 提取的JSON: {}", json_str);

    let translation_batch = match serde_json::from_str::<TranslationBatch>(json_str) {
        Ok(batch) => batch,
        Err(e) => {
            println!("[ERROR] JSON解析失败: {}", e);
            let mut result = Vec::new();
            for seg in chunk {
                result.push(SubtitleSegment {
                    index: seg.index,
                    start: seg.start,
                    end: seg.end,
                    original_text: seg.original_text.clone(),
                    translated_text: Some(seg.original_text.clone()),
                });
            }
            println!("[DEBUG] 批次 {}/{} 处理完成（使用原文作为翻译）", batch_idx + 1, total_batches);
            return Ok(result);
        }
    };

    println!("[DEBUG] 解析到 {} 条翻译结果, 本批次 {} 条字幕", translation_batch.translations.len(), chunk.len());

    let mut result = Vec::new();
    for (i, seg) in chunk.iter().enumerate() {
        let trans = translation_batch.translations.get(i)
            .map(|item| item.text.trim().to_string())
            .unwrap_or_else(|| seg.original_text.clone());

        println!("[DEBUG] 字幕 {}: 原文='{}', 翻译='{}'", seg.index, seg.original_text, trans);
        
        let segment_global_index = start_idx + i;
        let _ = app.emit("translation-progress", serde_json::json!({
            "batchIndex": batch_idx + 1,
            "totalBatches": total_batches,
            "progress": progress,
            "message": format!("处理字幕 {}/{}", segment_global_index + 1, total_segments_count),
            "segmentIndex": segment_global_index,
            "text": trans.clone()
        }));

        result.push(SubtitleSegment {
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
    println!("[DEBUG] 批次 {}/{} 处理完成", batch_idx + 1, total_batches);
    
    Ok(result)
}

#[tauri::command]
#[allow(non_snake_case)]
async fn translate_subtitle(
    app: tauri::AppHandle,
    segments: Vec<SubtitleSegment>,
    provider: &str,
    apikey: &str,
    model: &str,
    fromLang: &str,
    toLang: &str,
    systemPrompt: &str,
) -> Result<Vec<SubtitleSegment>, String> {
    let client = reqwest::Client::new();
    let batch_size = 25;
    let context_size = 5;
    let total_segments_count = segments.len();
    let total_batches = (total_segments_count + batch_size - 1) / batch_size;
    let concurrency = 5;

    println!("[INFO] === 开始翻译 ===");
    println!("[INFO] 总字幕数: {}", total_segments_count);
    println!("[INFO] 批次大小: {}", batch_size);
    println!("[INFO] 总批次数: {}", total_batches);
    println!("[INFO] 并发数: {}", concurrency);
    println!("[INFO] Provider: {}", provider);
    println!("[INFO] Model: {}", model);
    println!("[INFO] 源语言: {}", fromLang);
    println!("[INFO] 目标语言: {}", toLang);

    let mut all_results: Vec<(usize, Vec<SubtitleSegment>)> = Vec::with_capacity(total_batches);
    let mut completed_segments_count = 0;

    for i in (0..total_batches).step_by(concurrency) {
        let mut tasks = Vec::new();
        
        for j in i..std::cmp::min(i + concurrency, total_batches) {
            let start_idx = j * batch_size;
            let end_idx = std::cmp::min(start_idx + batch_size, total_segments_count);
            let chunk: Vec<SubtitleSegment> = segments[start_idx..end_idx].to_vec();
            
            let app_clone = app.clone();
            let client_clone = client.clone();
            let segments_clone = segments.clone();
            let provider_clone = provider.to_string();
            let apikey_clone = apikey.to_string();
            let model_clone = model.to_string();
            let from_lang_clone = fromLang.to_string();
            let to_lang_clone = toLang.to_string();
            let system_prompt_clone = systemPrompt.to_string();

            let task = tokio::spawn(async move {
                let result = translate_single_batch(
                    app_clone,
                    client_clone,
                    &segments_clone,
                    &chunk,
                    j,
                    batch_size,
                    total_batches,
                    total_segments_count,
                    &provider_clone,
                    &apikey_clone,
                    &model_clone,
                    &from_lang_clone,
                    &to_lang_clone,
                    &system_prompt_clone,
                    context_size,
                ).await;
                (j, result)
            });
            
            tasks.push(task);
        }

        let mut results = Vec::new();
        for task in tasks {
            match task.await {
                Ok((batch_idx, Ok(batch_segments))) => {
                    let seg_count = batch_segments.len();
                    completed_segments_count += seg_count;
                    
                    let progress = (completed_segments_count as f64 / total_segments_count as f64) * 100.0;
                    results.push((batch_idx, batch_segments));
                    let _ = app.emit("translation-progress", serde_json::json!({
                        "batchIndex": batch_idx + 1,
                        "totalBatches": total_batches,
                        "progress": progress,
                        "message": format!("已完成 {}/{} 条字幕", completed_segments_count, total_segments_count)
                    }));
                    println!("[INFO] 批次 {} 完成, 累计完成 {}/{} 条字幕, 进度: {:.1}%", 
                             batch_idx + 1, completed_segments_count, total_segments_count, progress);
                }
                Ok((_, Err(e))) => {
                    println!("[ERROR] 批次处理失败: {}", e);
                    return Err(e);
                }
                Err(e) => {
                    println!("[ERROR] 任务执行失败: {}", e);
                    return Err(format!("任务执行失败: {}", e));
                }
            }
        }
        all_results.extend(results);
    }

    all_results.sort_by_key(|(idx, _)| *idx);
    
    let mut final_results = Vec::new();
    for (_, segs) in all_results {
        final_results.extend(segs);
    }

    let _ = app.emit("translation-progress", serde_json::json!({
        "batchIndex": total_batches,
        "totalBatches": total_batches,
        "progress": 100.0,
        "message": "翻译完成"
    }));
    
    println!("[INFO] === 翻译完成 ===");
    println!("[INFO] 成功翻译 {} 条字幕", final_results.len());
    
    Ok(final_results)
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
                temperature: 0.3,
            };

            let response = client
                .post(url)
                .header("Content-Type", "application/json")
                .header("Authorization", format!("Bearer {}", apikey))
                .json(&request_body)
                .send()
                .await;

            match response {
                Ok(res) => {
                    let status = res.status();
                    println!("Response status: {}", status);
                    status.is_success()
                }
                Err(e) => {
                    println!("Error: {}", e);
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
                temperature: 0.3,
            };

            let response = client
                .post(url)
                .header("Content-Type", "application/json")
                .header("Authorization", format!("Bearer {}", apikey))
                .json(&request_body)
                .send()
                .await;

            match response {
                Ok(res) => {
                    let status = res.status();
                    println!("Response status: {}", status);
                    status.is_success()
                }
                Err(e) => {
                    println!("Error: {}", e);
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
                temperature: 0.3,
            };

            let response = client
                .post(url)
                .header("Content-Type", "application/json")
                .header("Authorization", format!("Bearer {}", apikey))
                .json(&request_body)
                .send()
                .await;

            match response {
                Ok(res) => {
                    let status = res.status();
                    println!("Response status: {}", status);
                    status.is_success()
                }
                Err(e) => {
                    println!("Error: {}", e);
                    false
                }
            }
        }
    };

    Ok(result)
}

#[tauri::command]
#[allow(non_snake_case)]
async fn transcribe_audio(
    app: tauri::AppHandle,
    audioPath: &str,
    model: &str,
    modelsPath: Option<&str>,
    _useCloud: bool,
    _apiKey: Option<&str>,
) -> Result<TranscriptionResult, String> {
    let start_time = std::time::Instant::now();
    
    let model_path = match modelsPath {
        Some(path) => {
            let mut p = std::path::PathBuf::from(path);
            p.push(model);
            let full_path = p.to_string_lossy().to_string();
            println!("模型路径 (modelsPath): {} + {} = {}", path, model, full_path);
            full_path
        }
        None => {
            let mut p = std::path::PathBuf::from("./models");
            p.push(model);
            let full_path = p.to_string_lossy().to_string();
            println!("模型路径 (默认): {} + {} = {}", "./models", model, full_path);
            full_path
        }
    };
    
    // 检查模型文件是否存在
    if !std::path::Path::new(&model_path).exists() {
        return Err(format!("模型文件不存在: {}", model_path));
    }
    
    println!("Loading model from: {}", model_path);
    
    let model = whisper_rs::WhisperContext::new(&model_path)
        .map_err(|e| format!("Failed to load model: {} - {}", model_path, e))?;

    let mut state = model.create_state().map_err(|e| format!("Failed to create state: {}", e))?;

    let mut params = whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(None);
    params.set_print_progress(false);
    params.set_print_timestamps(false);
    params.set_print_special(false);
    params.set_print_realtime(false);

    let audio_data = std::fs::read(audioPath).map_err(|e| format!("Failed to read audio file: {}", e))?;
    println!("音频文件读取成功，大小: {} bytes", audio_data.len());
    
    let audio = decode_wav(audio_data.as_slice())
        .map_err(|e| format!("Failed to load WAV file: {}", e))?;
    println!("WAV 文件解码成功，采样数: {}", audio.len());
    
    println!("开始转写...");
    state
        .full(params, &audio)
        .map_err(|e| format!("Failed to transcribe: {}", e))?;
    println!("转写完成！");

    let num_segments = state.full_n_segments().map_err(|e| format!("Failed to get segments: {}", e))?;
    let mut segments: Vec<SubtitleSegment> = Vec::new();

    for i in 0..num_segments {
        let start = state.full_get_segment_t0(i).map_err(|e| format!("Failed to get segment start: {}", e))? as f64 / 100.0;
        let mut end = state.full_get_segment_t1(i).map_err(|e| format!("Failed to get segment end: {}", e))? as f64 / 100.0;
        let text = state
            .full_get_segment_text(i)
            .map_err(|e| format!("Failed to get segment text: {}", e))?
            .trim()
            .to_string();

        if !text.is_empty() {
            let duration = end - start;
            if duration <= 0.0 || duration > 3600.0 {
                let estimated_end = start + 3.0;
                end = estimated_end;
                println!("[WARNING] 发现异常时间戳，索引{}: start={}, end={} -> 修正为: start={}, end={}", 
                         i, start, end, start, estimated_end);
            }
            if i > 0 {
                if let Some(last_seg) = segments.last() {
                    if start < last_seg.end {
                        println!("[WARNING] 发现重叠时间戳，索引{}: start={} < 上一个end={}", i, start, last_seg.end);
                    }
                }
            }

            segments.push(SubtitleSegment {
                index: i as u32,
                start,
                end,
                original_text: text,
                translated_text: None,
            });
        }
    }

    let detected_language = "auto".to_string();

    let processed_segments = postprocess_segments(segments);

    let elapsed = start_time.elapsed();
    println!("转写完成，耗时: {:.2}秒，生成字幕: {}条", elapsed.as_secs_f64(), processed_segments.len());
    
    let _ = app.emit("transcription-progress", serde_json::json!({
        "progress": 100.0,
        "message": format!("转写完成！耗时: {:.2}秒，生成字幕: {}条", elapsed.as_secs_f64(), processed_segments.len())
    }));

    Ok(TranscriptionResult {
        segments: processed_segments,
        detected_language,
        processing_duration: Some(elapsed.as_secs_f64()),
    })
}

#[tauri::command]
async fn select_save_path(default_path: &str, filter_name: &str, filter_ext: &str) -> Result<String, String> {
    let path = rfd::FileDialog::new()
        .set_file_name(default_path)
        .add_filter(filter_name, &[filter_ext])
        .save_file();

    match path {
        Some(p) => Ok(p.to_str().unwrap_or("").to_string()),
        None => Ok("".to_string()),
    }
}

#[tauri::command]
async fn select_folder() -> Result<String, String> {
    let path = rfd::FileDialog::new().pick_folder();

    match path {
        Some(p) => Ok(p.to_str().unwrap_or("").to_string()),
        None => Ok("".to_string()),
    }
}

#[tauri::command]
async fn select_models_directory() -> Result<String, String> {
    let path = rfd::FileDialog::new().pick_folder();

    match path {
        Some(p) => Ok(p.to_str().unwrap_or("").to_string()),
        None => Ok("".to_string()),
    }
}

#[tauri::command]
#[allow(non_snake_case)]
async fn check_model_files(modelsPath: &str, _models: Vec<String>) -> Result<std::collections::HashMap<String, String>, String> {
    use std::collections::HashMap;
    
    let mut status = HashMap::new();
    let path = std::path::PathBuf::from(modelsPath);
    
    if !path.exists() {
        status.insert("_error".to_string(), "Models path does not exist".to_string());
        return Ok(status);
    }
    
    let mut has_safetensors = false;
    
    if let Ok(entries) = std::fs::read_dir(&path) {
        for entry in entries.flatten() {
            let file_name = entry.file_name();
            let name = file_name.to_string_lossy().to_string();
            
            if name.ends_with(".bin") || name.ends_with(".ggml") {
                status.insert(name.clone(), entry.path().to_string_lossy().to_string());
            }
            
            if name.ends_with(".safetensors") {
                has_safetensors = true;
            }
        }
    }
    
    if has_safetensors {
        status.insert("_safetensors_detected".to_string(), "true".to_string());
    }
    
    Ok(status)
}

#[tauri::command]
async fn select_srt_file() -> Result<String, String> {
    let file = rfd::FileDialog::new()
        .add_filter("SRT Files", &["srt"])
        .pick_file();

    match file {
        Some(f) => Ok(f.to_str().unwrap_or("").to_string()),
        None => Ok("".to_string()),
    }
}

#[tauri::command]
async fn select_video_file() -> Result<serde_json::Value, String> {
    let file = rfd::FileDialog::new()
        .add_filter("Video Files", &["mp4", "mkv", "avi", "mov", "flv", "wmv"])
        .pick_file();

    match file {
        Some(f) => {
            let path = f.to_str().unwrap_or("");
            let name = f.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let size = f.metadata()
                .map(|m| m.len() as u64)
                .unwrap_or(0);
            
            Ok(serde_json::json!({
                "path": path,
                "name": name,
                "size": size
            }))
        }
        None => Ok(serde_json::json!({
            "path": "",
            "name": "",
            "size": 0
        })),
    }
}

#[tauri::command]
#[allow(non_snake_case)]
async fn extract_audio(videoPath: &str) -> Result<String, String> {
    println!("extract_audio called with path: {}", videoPath);
    
    let input_path = PathBuf::from(videoPath);
    
    if !input_path.exists() {
        return Err(format!("Input file does not exist: {}", videoPath));
    }
    
    let temp_dir = std::env::temp_dir();
    let output_path = temp_dir.join(format!("audio_{}.wav", std::process::id()));
    
    println!("Output path: {:?}", output_path);
    
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(300),
        tokio::process::Command::new("ffmpeg")
            .args([
                "-i",
                videoPath,
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                "-y",
                output_path.to_str().unwrap(),
            ])
            .output(),
    )
    .await;

    match output {
        Ok(Ok(output)) => {
            if output.status.success() {
                println!("Audio extraction successful");
                Ok(output_path.to_string_lossy().to_string())
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                println!("FFmpeg error: {}", error);
                Err(format!("FFmpeg failed: {}", error))
            }
        }
        Ok(Err(e)) => {
            println!("FFmpeg execution error: {}", e);
            Err(format!("FFmpeg execution failed: {}", e))
        }
        Err(_) => {
            println!("FFmpeg timed out");
            Err("Audio extraction timed out (5 minutes)".to_string())
        }
    }
}

#[tauri::command]
#[allow(non_snake_case)]
async fn get_audio_duration(audioPath: &str) -> Result<f64, String> {
    let metadata = fs::metadata(audioPath).map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let size = metadata.len();
    
    let estimated_duration = (size as f64 / 176400.0) * 2.0;
    
    Ok(estimated_duration)
}

#[tauri::command]
#[allow(non_snake_case)]
async fn export_srt(
    segments: Vec<SubtitleSegment>,
    outputPath: &str,
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

    fs::write(outputPath, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn list_files(path: &str, pattern: &str) -> Result<Vec<String>, String> {
    let path = Path::new(path);
    
    if !path.exists() || !path.is_dir() {
        return Ok(Vec::new());
    }

    let files: Vec<String> = fs::read_dir(path)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with(pattern) {
                Some(file_name)
            } else {
                None
            }
        })
        .collect();

    Ok(files)
}

#[tauri::command]
async fn parse_srt_file(file_path: &str) -> Result<Vec<SubtitleSegment>, String> {
    let content = fs::read_to_string(file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    
    let mut segments = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;
    
    while i < lines.len() {
        let line = lines[i].trim();
        
        if line.is_empty() {
            i += 1;
            continue;
        }
        
        if let Ok(index) = line.parse::<u32>() {
            if i + 2 < lines.len() {
                let time_line = lines[i + 1].trim();
                if time_line.contains("-->") {
                    let parts: Vec<&str> = time_line.split("-->").collect();
                    if parts.len() == 2 {
                        let parse_time = |s: &str| -> Result<f64, String> {
                            let s = s.trim();
                            let parts: Vec<&str> = s.split(',').collect();
                            if parts.len() != 2 {
                                return Err("Invalid time format".to_string());
                            }
                            let time_parts: Vec<&str> = parts[0].split(':').collect();
                            if time_parts.len() != 3 {
                                return Err("Invalid time format".to_string());
                            }
                            let hours: f64 = time_parts[0].parse().map_err(|_| "Invalid hours".to_string())?;
                            let minutes: f64 = time_parts[1].parse().map_err(|_| "Invalid minutes".to_string())?;
                            let seconds: f64 = time_parts[2].parse().map_err(|_| "Invalid seconds".to_string())?;
                            let millis: f64 = parts[1].parse().map_err(|_| "Invalid millis".to_string())?;
                            Ok(hours * 3600.0 + minutes * 60.0 + seconds + millis / 1000.0)
                        };
                        
                        match (parse_time(parts[0]), parse_time(parts[1])) {
                            (Ok(start), Ok(end)) => {
                                let mut text = String::new();
                                i += 3;
                                while i < lines.len() && !lines[i].trim().is_empty() {
                                    if !text.is_empty() {
                                        text.push('\n');
                                    }
                                    text.push_str(lines[i]);
                                    i += 1;
                                }
                                
                                segments.push(SubtitleSegment {
                                    index,
                                    start,
                                    end,
                                    original_text: text,
                                    translated_text: None,
                                });
                                continue;
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
        i += 1;
    }
    
    let processed_segments = postprocess_segments(segments);
    
    Ok(processed_segments)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            transcribe_audio,
            translate_subtitle,
            test_api_connection,
            export_srt,
            select_save_path,
            select_folder,
            select_models_directory,
            check_model_files,
            select_srt_file,
            select_video_file,
            extract_audio,
            get_audio_duration,
            list_files,
            parse_srt_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

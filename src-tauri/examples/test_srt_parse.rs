use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleSegment {
    pub index: u32,
    pub start: f64,
    pub end: f64,
    pub original_text: String,
    pub translated_text: Option<String>,
}

fn main() {
    let file_path = "/Users/meiyangli/codebase/gitlab/movie-subtitling/temp/arge-v3-q5-Sabakan.Uchuu.e.Iku.Ep05.Chi_Jap.HDTVrip.1920X1080-ZhuixinFan_original.srt";

    println!("[TEST] Reading file: {}", file_path);

    let content = fs::read_to_string(file_path).expect("Failed to read file");
    println!("[TEST] File content length: {} characters", content.len());
    println!("[TEST] First 200 chars:\n{}", &content.chars().take(200).collect::<String>());

    let lines: Vec<&str> = content.lines().collect();
    println!("[TEST] Total lines: {}", lines.len());

    // 检查前几行的内容
    for i in 0..std::cmp::min(10, lines.len()) {
        println!("[TEST] Line {}: {:?}", i, lines[i]);
    }

    // 手动模拟解析逻辑
    let mut i = 0;
    let mut count = 0;
    while i < lines.len() && count < 5 {
        let line = lines[i].trim();

        if line.is_empty() {
            i += 1;
            continue;
        }

        if let Ok(index) = line.parse::<u32>() {
            println!("\n[TEST] Found index {} at line {}", index, i);

            if i + 2 < lines.len() {
                let time_line = lines[i + 1].trim();
                println!("[TEST] Time line {}: {}", i + 1, time_line);

                if time_line.contains("-->") {
                    let parts: Vec<&str> = time_line.split("-->").collect();
                    if parts.len() == 2 {
                        println!("[TEST] Parts: {:?}, {:?}", parts[0], parts[1]);

                        // 尝试解析时间
                        let parse_time = |s: &str| -> Result<f64, String> {
                            let s = s.trim();
                            println!("[TEST] parse_time input: {:?}", s);

                            let parts: Vec<&str> = if s.contains(',') {
                                s.split(',').collect()
                            } else if s.contains('.') {
                                s.split('.').collect()
                            } else {
                                return Err("Invalid time format".to_string());
                            };

                            println!("[TEST] After comma/dot split: {:?}", parts);

                            if parts.len() != 2 {
                                return Err("Invalid time format".to_string());
                            }

                            let time_parts: Vec<&str> = parts[0].split(':').collect();
                            println!("[TEST] Time parts: {:?}", time_parts);

                            let (hours, minutes, seconds) = match time_parts.len() {
                                2 => {
                                    let minutes: f64 = time_parts[0].parse().map_err(|_| "Invalid minutes".to_string())?;
                                    let seconds: f64 = time_parts[1].parse().map_err(|_| "Invalid seconds".to_string())?;
                                    (0.0, minutes, seconds)
                                },
                                3 => {
                                    let hours: f64 = time_parts[0].parse().map_err(|_| "Invalid hours".to_string())?;
                                    let minutes: f64 = time_parts[1].parse().map_err(|_| "Invalid minutes".to_string())?;
                                    let seconds: f64 = time_parts[2].parse().map_err(|_| "Invalid seconds".to_string())?;
                                    (hours, minutes, seconds)
                                },
                                _ => return Err("Invalid time format".to_string()),
                            };

                            let millis: f64 = parts[1].parse().map_err(|_| "Invalid millis".to_string())?;
                            let result = hours * 3600.0 + minutes * 60.0 + seconds + millis / 1000.0;
                            println!("[TEST] Parsed time: {}", result);
                            Ok(result)
                        };

                        match (parse_time(parts[0]), parse_time(parts[1])) {
                            (Ok(start), Ok(end)) => {
                                println!("[TEST] SUCCESS: start={}, end={}", start, end);

                                let mut text = String::new();
                                i += 2;
                                println!("[TEST] After i+=2, i={}, lines[i]={:?}", i, lines.get(i));

                                while i < lines.len() && !lines[i].trim().is_empty() {
                                    if !text.is_empty() {
                                        text.push('\n');
                                    }
                                    text.push_str(lines[i]);
                                    println!("[TEST] Collected line {}: {:?}", i, lines[i]);
                                    i += 1;
                                }

                                println!("[TEST] Final text for index {} (len={}): {:?}", index, text.len(), text);
                                count += 1;
                                continue;
                            }
                            _ => {
                                println!("[TEST] FAILED: Time parsing failed");
                            }
                        }
                    }
                }
            }
        }
        i += 1;
    }
}

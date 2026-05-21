use super::processor::SubtitleProcessor;
use super::rules::PostProcessConfig;
use crate::SubtitleSegment;

pub struct TimingProcessor;

impl SubtitleProcessor for TimingProcessor {
    fn name(&self) -> &'static str {
        "TimingProcessor"
    }
    
    fn process(&self, segments: Vec<SubtitleSegment>, config: &PostProcessConfig) -> Vec<SubtitleSegment> {
        if segments.is_empty() {
            return segments;
        }
        
        let mut result = Vec::new();
        let mut current_segment = Self::sanitize_segment(&segments[0]);
        
        for seg in segments.iter().skip(1) {
            let sanitized_seg = Self::sanitize_segment(seg);
            let duration = sanitized_seg.end - sanitized_seg.start;
            
            if duration <= 0.0 || duration > 3600.0 {
                result.push(current_segment);
                current_segment = sanitized_seg;
                continue;
            }
            
            let current_duration = current_segment.end - current_segment.start;
            if current_duration > 3600.0 {
                result.push(current_segment);
                current_segment = sanitized_seg;
                continue;
            }
            
            if duration < config.min_duration_ms {
                if sanitized_seg.start >= current_segment.start && 
                   sanitized_seg.start <= current_segment.end + config.merge_threshold_ms {
                    current_segment.end = sanitized_seg.end;
                    if !current_segment.original_text.ends_with(&sanitized_seg.original_text) {
                        current_segment.original_text.push(' ');
                        current_segment.original_text.push_str(&sanitized_seg.original_text);
                    }
                } else {
                    result.push(current_segment);
                    current_segment = sanitized_seg;
                }
                continue;
            }
            
            if duration > config.max_duration_ms {
                let split_segments = TimingProcessor::split_long_segment(&sanitized_seg, config.max_duration_ms);
                result.push(current_segment.clone());
                result.extend(split_segments);
                if let Some(last) = result.last() {
                    current_segment = last.clone();
                }
                continue;
            }
            
            if config.merge_overlapping && sanitized_seg.start < current_segment.end {
                let gap = current_segment.end - sanitized_seg.start;
                if gap < config.merge_threshold_ms && sanitized_seg.end <= current_segment.end + 10.0 {
                    current_segment.end = sanitized_seg.end.max(current_segment.end);
                    if !current_segment.original_text.ends_with(&sanitized_seg.original_text) {
                        current_segment.original_text.push(' ');
                        current_segment.original_text.push_str(&sanitized_seg.original_text);
                    }
                } else {
                    result.push(current_segment);
                    current_segment = sanitized_seg;
                }
                continue;
            }
            
            result.push(current_segment);
            current_segment = sanitized_seg;
        }
        
        result.push(current_segment);
        
        result
    }
}

impl TimingProcessor {
    fn sanitize_segment(seg: &SubtitleSegment) -> SubtitleSegment {
        let mut sanitized = seg.clone();
        let duration = sanitized.end - sanitized.start;
        
        if duration <= 0.0 || duration > 3600.0 {
            let estimated_end = sanitized.start + 3.0;
            sanitized.end = estimated_end;
        }
        
        sanitized
    }
}

impl TimingProcessor {
    fn split_long_segment(seg: &SubtitleSegment, max_duration: f64) -> Vec<SubtitleSegment> {
        let mut result = Vec::new();
        let text = &seg.original_text;
        let total_duration = seg.end - seg.start;
        let num_parts = (total_duration / max_duration).ceil() as usize;
        let part_duration = total_duration / num_parts as f64;
        
        let chars: Vec<char> = text.chars().collect();
        let part_size = (chars.len() + num_parts - 1) / num_parts;
        
        for i in 0..num_parts {
            let start_idx = i * part_size;
            let end_idx = std::cmp::min(start_idx + part_size, chars.len());
            
            if start_idx >= chars.len() {
                break;
            }
            
            let part_text: String = chars[start_idx..end_idx].iter().collect();
            
            let seg_start = seg.start + i as f64 * part_duration;
            let seg_end = if i == num_parts - 1 {
                seg.end
            } else {
                seg.start + (i + 1) as f64 * part_duration
            };
            
            result.push(SubtitleSegment {
                index: seg.index + i as u32,
                start: seg_start,
                end: seg_end,
                original_text: part_text,
                translated_text: None,
            });
        }
        
        result
    }
}
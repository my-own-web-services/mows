use std::process::Command;

use crate::{config::CONFIG, utils::get_folder_and_file_path};

pub async fn convert(source_path: &str, storage_path: &str, file_id: &str) -> anyhow::Result<()> {
    let config = &CONFIG;
    let video_quality = config.video.quality;
    let mut video_targets = config.video.target_resolutions.clone();
    video_targets.sort();
    let cores = 5;

    let (folder_path, file_name) = get_folder_and_file_path(file_id, storage_path);

    let path = format!("{folder_path}/{file_name}/");

    std::fs::create_dir_all(format!("{path}t"))?;

    let mut resolution_command = Command::new("ffprobe");

    resolution_command.args(&[
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=s=x:p=0",
        source_path,
    ]);

    let output = resolution_command.output()?.stdout;
    let resolution_str = std::str::from_utf8(&output)?.trim();
    let resolution: Vec<&str> = resolution_str.split("x").collect();
    let height: u16 = resolution[1].parse()?;

    // dont create videos that are larger than the source
    let video_targets = video_targets
        .iter()
        .filter(|&&target| target <= height)
        .collect::<Vec<_>>();

    let mut video_length_command = Command::new("ffprobe");

    video_length_command
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(source_path);

    let output = video_length_command.output()?.stdout;
    let video_length_str = std::str::from_utf8(&output)?.trim();
    let video_length: f64 = video_length_str.parse()?;

    let mut video_command = Command::new("ffmpeg");

    video_command
        .arg("-hide_banner")
        .arg("-y")
        .arg("-i")
        .arg(source_path)
        .arg("-dash")
        .arg("1")
        .arg("-f")
        .arg("webm");

    for video_target in &video_targets {
        video_command
            .arg("-an")
            .arg("-vf")
            .arg(format!("scale=-1:{video_target}"))
            .arg("-c:v")
            .arg("libsvtav1")
            .arg("-b:v")
            .arg("0")
            .arg("-crf")
            .arg(video_quality.to_string())
            .arg("-dash")
            .arg("1")
            .arg(format!("{path}{video_target}.webm"));
    }

    video_command.spawn()?.wait()?;

    let mut audio_command = Command::new("ffmpeg");

    audio_command
        .arg("-hide_banner")
        .arg("-y")
        .arg("-i")
        .arg(source_path)
        .arg("-vn")
        .arg("-c:a")
        .arg("libopus")
        .arg("-b:a")
        .arg("128k")
        .arg("-f")
        .arg("webm")
        .arg("-dash")
        .arg("1")
        .arg(format!("{path}audio.webm"));

    let audio_result = audio_command.spawn()?.wait();

    let mut manifest_command = Command::new("ffmpeg");

    manifest_command.arg("-hide_banner").arg("-y");

    let mut all_targets = 0;
    let mut video_adaption_sets = "".to_string();
    let mut audio_adaption_sets = "".to_string();

    for (i, video_target) in video_targets.iter().enumerate() {
        manifest_command
            .arg("-f")
            .arg("webm_dash_manifest")
            .arg("-i")
            .arg(format!("{path}{video_target}.webm"));
        video_adaption_sets += format!("{},", i).as_str();
        all_targets += 1;
    }

    match audio_result {
        Ok(_) => {
            manifest_command
                .arg("-f")
                .arg("webm_dash_manifest")
                .arg("-i")
                .arg(format!("{path}audio.webm"));
            audio_adaption_sets += format!("{},", video_targets.len()).as_str();

            all_targets += 1;
        }
        Err(_) => {}
    };

    manifest_command.arg("-c").arg("copy");

    for num in 0..all_targets {
        manifest_command.arg("-map").arg(num.to_string());
    }

    video_adaption_sets.pop();
    audio_adaption_sets.pop();

    let adaption_sets = match audio_result {
        Ok(_) => format!("id=0,streams={video_adaption_sets} id=1,streams={audio_adaption_sets}"),
        Err(_) => format!("id=0,streams={video_adaption_sets}"),
    };

    manifest_command
        .arg("-f")
        .arg("webm_dash_manifest")
        .arg("-adaptation_sets")
        .arg(adaption_sets)
        .arg(format!("{path}manifest.mpd"));

    manifest_command.spawn()?.wait()?;

    let mut thumbnail_command = Command::new("ffmpeg");

    let thumbnail_count = 10.0;

    let a = video_length / thumbnail_count;

    thumbnail_command
        .arg("-hide_banner")
        .arg("-y")
        .arg("-i")
        .arg(source_path)
        .arg("-c:v")
        .arg("libwebp")
        .arg("-vf")
        .arg(format!("scale=-1:480,fps=1/{a}"))
        .arg(format!("{path}t/%d.webp"));

    thumbnail_command.spawn()?.wait()?;

    Ok(())
}

/*
  // pack all files into an archive
    let file = File::create(format!("{target_folder}{file_id}.dash.tar"))?;
    let mut tar = tar::Builder::new(file);

    for video_target in &video_targets {
        let name = format!("{target_folder}{video_target}.webm");
        let mut file = File::open(&name)?;
        tar.append_file(format!("{video_target}.webm"), &mut file)?;
    }

    match audio_result {
        Ok(_) => {
            let name = format!("{target_folder}audio.webm");
            let mut file = File::open(&name)?;
            tar.append_file("audio.webm", &mut file)?;
        }
        Err(_) => {}
    };

    let name = format!("{target_folder}manifest.mpd");
    let mut file = File::open(&name)?;
    tar.append_file("manifest.mpd", &mut file)?;
    std::fs::remove_dir_all(temp_folder)?;

*/
